import { prisma } from "@/lib/prisma";
import { fetchMonthStats, demoMonthStats, searchConsoleConfigured } from "@/lib/google-search";
import { summarizeMonth } from "@/lib/ai";
import { notifyClient } from "@/lib/notify";
import { appUrl } from "@/lib/email";
import { recapEmail } from "@/lib/emails/recap";
import { maybeCreateReviewPrompt } from "@/lib/review-prompt";
import { parisDateTime } from "@/lib/crm";

export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;

/** Mois précédent complet (le récap du 4 porte sur le mois d'avant). */
export function previousMonth(d = new Date()) {
  const m = d.getMonth(); // 0-11
  return m === 0 ? { year: d.getFullYear() - 1, month: 12 } : { year: d.getFullYear(), month: m };
}

/** Synchronise les chiffres Search Console d'un mois pour un site. Mode démo si Google n'est pas configuré. */
export async function syncSiteMonth(siteId: string, year: number, month: number) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const property = site.searchConsoleProp;
  let stats = null;
  if (property && (await searchConsoleConfigured())) {
    try {
      stats = await fetchMonthStats(property, year, month);
    } catch (e) {
      console.warn(`[search-console] ${site.name} (${property}) : ${(e as Error).message}`);
      return null; // propriété inaccessible : pas de chiffres inventés pour un vrai site
    }
  } else {
    stats = demoMonthStats(site.siteKey, year, month);
  }
  if (!stats) return null;
  return prisma.searchStatsMonthly.upsert({
    where: { siteId_year_month: { siteId, year, month } },
    create: { siteId, year, month, ...stats },
    update: { ...stats },
  });
}

export type SyncResult = { real: boolean; months: number; error?: string };

/**
 * Synchronise les N derniers mois complets d'un site.
 * Vrai Google : si le premier mois échoue, on s'arrête avec le message de Google ; sinon on remplace
 * toutes les anciennes lignes du site (dont les mois de démo) par les vrais chiffres.
 */
export async function syncSiteMonths(siteId: string, count = 12): Promise<SyncResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  let { year, month } = previousMonth();
  const list: { year: number; month: number }[] = [];
  for (let i = 0; i < count; i++) { list.push({ year, month }); month -= 1; if (month === 0) { month = 12; year -= 1; } }

  const real = Boolean(site.searchConsoleProp && (await searchConsoleConfigured()));
  if (!real) {
    for (const m of list) await syncSiteMonth(siteId, m.year, m.month);
    return { real: false, months: list.length };
  }
  const rows = [];
  for (const m of list) {
    try {
      const stats = await fetchMonthStats(site.searchConsoleProp!, m.year, m.month);
      if (stats) rows.push({ ...m, ...stats });
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? (e as Error).message;
      console.warn(`[search-console] ${site.name} (${site.searchConsoleProp}) : ${msg}`);
      if (rows.length === 0) return { real: true, months: 0, error: msg };
      break;
    }
  }
  await prisma.$transaction([
    prisma.searchStatsMonthly.deleteMany({ where: { siteId } }),
    ...rows.map((r) => prisma.searchStatsMonthly.create({ data: { siteId, ...r } })),
  ]);
  return { real: true, months: rows.length };
}

/** Génère (ou régénère) le récap d'un mois : chiffres + résumé + notification + email. */
export async function buildRecap(siteId: string, year: number, month: number, opts: { notify?: boolean } = {}) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const stats = (await prisma.searchStatsMonthly.findUnique({ where: { siteId_year_month: { siteId, year, month } } })) ?? (await syncSiteMonth(siteId, year, month));
  if (!stats) return null;
  const prevYm = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const prev = await prisma.searchStatsMonthly.findUnique({ where: { siteId_year_month: { siteId, ...prevYm } } });
  const start = new Date(year, month - 1, 1), end = new Date(year, month, 1);
  const [contactCount, reviewCount] = await Promise.all([
    prisma.contactRequest.count({ where: { siteId, createdAt: { gte: start, lt: end } } }),
    prisma.review.count({ where: { siteId, publishedAt: { gte: start, lt: end } } }),
  ]);
  const topQueries = (stats.topQueries as { query: string; clicks: number }[]) ?? [];
  const summary = await summarizeMonth({
    siteName: site.name, monthLabel: monthLabel(year, month),
    clicks: stats.clicks, prevClicks: prev?.clicks ?? null, impressions: stats.impressions, prevImpressions: prev?.impressions ?? null,
    position: stats.position, prevPosition: prev?.position ?? null, contactCount, reviewCount, topQueries,
  });
  const isPositive = (prev ? stats.clicks >= prev.clicks : stats.clicks > 0) || contactCount >= 3;

  const recap = await prisma.monthlyRecap.upsert({
    where: { siteId_year_month: { siteId, year, month } },
    create: { siteId, year, month, summary, contactCount, reviewCount, clicks: stats.clicks, isPositive },
    update: { summary, contactCount, reviewCount, clicks: stats.clicks, isPositive },
  });

  if (opts.notify && !recap.sentAt) {
    const href = `/sites/${siteId}/resultats`;
    const label = monthLabel(year, month);
    await notifyClient({
      clientId: site.clientId, siteId, kind: "RECAP_MENSUEL", pref: "recaps",
      title: `Votre récap de ${label} est prêt`, body: summary.split(". ")[0] + ".", href,
      ...emailFields(await recapEmailFor(siteId, year, month)),
    });
    await prisma.monthlyRecap.update({ where: { id: recap.id }, data: { sentAt: new Date() } });
    if (isPositive) await maybeCreateReviewPrompt(site.clientId, "RECAP_POSITIF");
  }
  return recap;
}

const emailFields = (e: { subject: string; html: string; text: string } | null) => (e ? { emailSubject: e.subject, emailHtml: e.html, emailText: e.text } : {});

/** Email du récap d'un mois (objet, HTML, texte), à partir des chiffres et du récap déjà enregistrés. */
export async function recapEmailFor(siteId: string, year: number, month: number) {
  const prevYm = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const start = new Date(year, month - 1, 1), end = new Date(year, month, 1);
  const [site, stats, prev, recap, faits, articles] = await Promise.all([
    prisma.site.findUniqueOrThrow({ where: { id: siteId } }),
    prisma.searchStatsMonthly.findUnique({ where: { siteId_year_month: { siteId, year, month } } }),
    prisma.searchStatsMonthly.findUnique({ where: { siteId_year_month: { siteId, ...prevYm } } }),
    prisma.monthlyRecap.findUnique({ where: { siteId_year_month: { siteId, year, month } } }),
    prisma.siteHistoryEntry.findMany({ where: { siteId, happenedAt: { gte: start, lt: end }, kind: { in: ["INTERVENTION", "MISE_EN_LIGNE"] } }, orderBy: { happenedAt: "asc" }, select: { title: true } }),
    prisma.article.findMany({ where: { siteId, statut: "PUBLIE", publieAt: { gte: start, lt: end } }, orderBy: { publieAt: "asc" }, select: { titre: true } }),
  ]);
  if (!stats || !recap) return null;
  return recapEmail({
    siteName: site.name, monthLabel: monthLabel(year, month), prevMonthLabel: MONTHS[prevYm.month - 1],
    clicks: stats.clicks, prevClicks: prev?.clicks ?? null,
    impressions: stats.impressions, prevImpressions: prev?.impressions ?? null,
    position: stats.position, prevPosition: prev?.position ?? null,
    contactCount: recap.contactCount, reviewCount: recap.reviewCount,
    topQueries: (stats.topQueries as { query: string; clicks: number }[]) ?? [],
    summary: recap.summary, href: appUrl(`/sites/${siteId}/resultats`),
    faits: faits.map((f) => f.title), articles: articles.map((a) => a.titre),
  });
}

// ─── Envoi automatique ───────────────────────────────────────
/** Jour du mois et heure (Paris) de l'envoi automatique : le 4 à 8 h (Google a alors les chiffres du mois écoulé). */
export const RECAP_JOUR = 4;
export const RECAP_HEURE = 8;

function parisParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, Number(x.value)]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour };
}
/** Le mois dont le récap part ce mois-ci (le mois précédent, à l'heure de Paris). */
export function moisDuRecap(d = new Date()) {
  const p = parisParts(d);
  return p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 };
}
/** L'envoi de ce mois est-il ouvert (le 4 à 8 h passé) ? */
export function envoiOuvert(d = new Date()) {
  const p = parisParts(d);
  return p.day > RECAP_JOUR || (p.day === RECAP_JOUR && p.hour >= RECAP_HEURE);
}
/** Date du prochain envoi pour un site : le 4 du mois prochain si celui du mois est fait, sinon le 4 de ce mois (ou « dès que possible »). */
export async function prochainEnvoi(siteId: string, d = new Date()): Promise<{ date: Date; enRetard: boolean }> {
  const p = parisParts(d);
  const cible = moisDuRecap(d);
  const fait = await prisma.monthlyRecap.findFirst({ where: { siteId, ...cible, sentAt: { not: null } }, select: { id: true } });
  const le4 = (year: number, month: number) => parisDateTime(`${year}-${String(month).padStart(2, "0")}-${String(RECAP_JOUR).padStart(2, "0")}`, `${String(RECAP_HEURE).padStart(2, "0")}:00`);
  if (fait) return { date: p.month === 12 ? le4(p.year + 1, 1) : le4(p.year, p.month + 1), enRetard: false };
  return envoiOuvert(d) ? { date: d, enRetard: true } : { date: le4(p.year, p.month), enRetard: false };
}

/**
 * Envoi mensuel : pour chaque site en ligne en récap automatique (synchro Search Console réussie),
 * récupère les chiffres du mois écoulé, rédige le récap et l'envoie au client, une seule fois par mois.
 * Si Google ne répond pas, on réessaie au passage suivant.
 */
export async function runMonthlyRecaps(target = moisDuRecap()) {
  const sites = await prisma.site.findMany({
    where: { status: "EN_LIGNE", recapAuto: true, searchConsoleProp: { not: null }, recaps: { none: { ...target, sentAt: { not: null } } } },
    select: { id: true, name: true },
  });
  const results: { site: string; ok: boolean; error?: string }[] = [];
  for (const s of sites) {
    try {
      const stats = await syncSiteMonth(s.id, target.year, target.month);
      if (!stats) { results.push({ site: s.name, ok: false, error: "chiffres Google indisponibles, nouvel essai plus tard" }); continue; }
      await buildRecap(s.id, target.year, target.month, { notify: true });
      results.push({ site: s.name, ok: true });
    } catch (e) {
      results.push({ site: s.name, ok: false, error: (e as Error).message });
    }
  }
  return { target, results };
}

/**
 * Après une synchro réelle réussie : le site passe en récap automatique, et le récap du mois écoulé
 * part tout de suite s'il n'est pas encore parti (si on est avant le 4, il partira le 4).
 */
export async function activerRecapAuto(siteId: string): Promise<string> {
  await prisma.site.update({ where: { id: siteId }, data: { recapAuto: true } });
  const t = moisDuRecap();
  const deja = await prisma.monthlyRecap.findUnique({ where: { siteId_year_month: { siteId, ...t } }, select: { sentAt: true } });
  const label = monthLabel(t.year, t.month);
  if (deja?.sentAt) return `Récap de ${label} déjà envoyé le ${deja.sentAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.`;
  if (!envoiOuvert()) {
    await buildRecap(siteId, t.year, t.month);
    return `Récap de ${label} prêt, envoi automatique le ${RECAP_JOUR}.`;
  }
  const r = await buildRecap(siteId, t.year, t.month, { notify: true });
  return r ? `Récap de ${label} envoyé au client.` : `Pas encore de chiffres pour ${label} : nouvel essai automatique dans l’heure.`;
}

/** Boucle du serveur : toutes les heures, envoie les récaps du mois dès que le 4 à 8 h est passé. */
export function startRecapsTicker() {
  const g = globalThis as { __recapsTicker?: NodeJS.Timeout };
  if (g.__recapsTicker) return;
  const tick = async () => {
    if (!envoiOuvert()) return;
    try {
      const out = await runMonthlyRecaps();
      const sent = out.results.filter((r) => r.ok).length;
      if (out.results.length) console.log(`[recaps] ${monthLabel(out.target.year, out.target.month)} : ${sent} envoyé(s)`, out.results.filter((r) => !r.ok));
    } catch (e) {
      console.warn("[recaps]", (e as Error).message);
    }
  };
  setTimeout(tick, 90_000);
  g.__recapsTicker = setInterval(tick, 3600_000);
}
