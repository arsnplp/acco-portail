import { prisma } from "@/lib/prisma";
import { fetchMonthStats, demoMonthStats, searchConsoleConfigured } from "@/lib/google-search";
import { summarizeMonth } from "@/lib/ai";
import { notifyClient } from "@/lib/notify";
import { layout, appUrl } from "@/lib/email";

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
  const stats = property && searchConsoleConfigured() ? await fetchMonthStats(property, year, month) : demoMonthStats(site.siteKey, year, month);
  if (!stats) return null;
  return prisma.searchStatsMonthly.upsert({
    where: { siteId_year_month: { siteId, year, month } },
    create: { siteId, year, month, ...stats },
    update: { ...stats },
  });
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
      emailSubject: `${site.name} : votre mois de ${label} en 3 chiffres`,
      emailHtml: layout(`Votre mois de ${label}`, `
        <table role="presentation" width="100%" style="margin:8px 0 16px;border-collapse:separate;border-spacing:8px 0"><tr>
          ${tile(stats.clicks, "visites depuis Google")}${tile(contactCount, "demandes de clients")}${tile(reviewCount, "nouveaux avis")}
        </tr></table>
        <p>${summary}</p>`, { label: "Voir mes résultats", href: appUrl(href) }),
    });
    await prisma.monthlyRecap.update({ where: { id: recap.id }, data: { sentAt: new Date() } });
  }
  return recap;
}

function tile(n: number, label: string) {
  return `<td style="width:33%;background:#f4f4f5;border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:800;color:#0e0e0f">${n}</div><div style="font-size:12px;color:#71717a">${label}</div></td>`;
}

/** Tâche du 4 du mois : tous les sites en ligne. */
export async function runMonthlyRecaps(target = previousMonth()) {
  const sites = await prisma.site.findMany({ where: { status: "EN_LIGNE" }, select: { id: true, name: true } });
  const results: { site: string; ok: boolean; error?: string }[] = [];
  for (const s of sites) {
    try {
      await syncSiteMonth(s.id, target.year, target.month);
      await buildRecap(s.id, target.year, target.month, { notify: true });
      results.push({ site: s.name, ok: true });
    } catch (e) {
      results.push({ site: s.name, ok: false, error: (e as Error).message });
    }
  }
  return { target, results };
}
