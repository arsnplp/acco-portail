/**
 * Blogs (14.4, demande d'Arsène du 3 novembre) : un article par lundi et par site, jamais de doublon.
 * File « blogs demandés » (client ou équipe) → rédaction (IA sur clic ou automatisation, règles SEO + maillage interne +
 * référencement local) → « prévu pour lundi prochain » → publié par le développeur (URL). Alerte rouge + notification aux
 * développeurs et à Arsène si rien n'a été publié le dernier lundi.
 */
import { prisma } from "@/lib/prisma";
import { iaAutorisee } from "@/lib/ia";
import { texteIA } from "@/lib/ai";
import { normName } from "@/lib/crm";
import { sendPushToUser } from "@/lib/push";
import { gestionnaireEmails } from "@/lib/roles";
import { logActivite } from "@/lib/activite";
import { WORKER_HEARTBEAT_KEY, workerOnline } from "@/lib/change-requests";

export const slugDe = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

const TZ = "Europe/Paris";
const jourParis = (d: Date) => new Date(`${d.toLocaleDateString("en-CA", { timeZone: TZ })}T12:00:00Z`); // midi UTC : stable
/** Dernier lundi (aujourd'hui compris) et prochain lundi (strictement après aujourd'hui), à midi UTC. */
export function dernierLundi(now = new Date()) { const d = jourParis(now); const r = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - r); return d; }
export function prochainLundi(now = new Date()) { const d = dernierLundi(now); d.setUTCDate(d.getUTCDate() + 7); return d; }
export const fmtLundi = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(d);
const BLOG_RE = /blog|article|contenu|rédac|redac|seo/i;

/** Sites dont le client a souscrit une offre de contenu (blog), avec client et développeur. */
export async function sitesAvecBlog() {
  const sites = await prisma.site.findMany({
    where: { status: { not: "SUSPENDU" }, OR: [{ subscriptions: { some: { status: "ACTIF" } } }, { client: { subscriptions: { some: { status: "ACTIF", siteId: null } } } }] },
    orderBy: { name: "asc" },
    include: { client: { select: { id: true, name: true, logoMiniPath: true, address: true, secteur: true, developpeurId: true, subscriptions: { where: { status: "ACTIF", siteId: null }, include: { offer: { select: { name: true } } } } } }, developpeur: { select: { id: true, firstName: true, email: true } }, subscriptions: { where: { status: "ACTIF" }, include: { offer: { select: { name: true } } } } },
  });
  return sites.filter((s) => [...s.subscriptions, ...s.client.subscriptions].some((x) => BLOG_RE.test(`${x.label} ${x.offer?.name ?? ""}`)));
}

/** État du blog d'un site : dernier lundi publié ou non, prochain lundi prévu, file d'attente. */
export async function etatBlog(siteId: string, now = new Date()) {
  const dl = dernierLundi(now), pl = prochainLundi(now);
  const finSemaine = new Date(dl.getTime() + 7 * 86400_000);
  const [publies, dernier, prochain, demandes, rediges, derniersPublies] = await Promise.all([
    prisma.article.count({ where: { siteId, statut: "PUBLIE", OR: [{ prevuPour: dl }, { publieAt: { gte: new Date(dl.getTime() - 12 * 3600_000), lt: finSemaine } }] } }),
    prisma.article.findFirst({ where: { siteId, statut: "PUBLIE" }, orderBy: { publieAt: "desc" } }),
    prisma.article.findFirst({ where: { siteId, prevuPour: pl } }),
    prisma.article.findMany({ where: { siteId, statut: "A_REDIGER" }, orderBy: { createdAt: "asc" } }),
    prisma.article.findMany({ where: { siteId, statut: "REDIGE" }, orderBy: { createdAt: "asc" } }),
    prisma.article.findMany({ where: { siteId, statut: "PUBLIE" }, orderBy: { publieAt: "desc" }, take: 20 }),
  ]);
  const enRetard = dl.getTime() <= jourParis(now).getTime() && publies === 0;
  return { dernierLundi: dl, prochainLundi: pl, publieDernierLundi: publies > 0, enRetard, dernier, prochain, demandes, rediges, derniersPublies };
}

/** Premier lundi libre à partir du prochain lundi (un seul article par lundi). */
export async function prochainLundiLibre(siteId: string, now = new Date()) {
  const pris = new Set((await prisma.article.findMany({ where: { siteId, prevuPour: { not: null } }, select: { prevuPour: true } })).map((a) => a.prevuPour!.getTime()));
  const d = prochainLundi(now);
  while (pris.has(d.getTime())) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

/** Doublon : même titre (normalisé) déjà présent pour le site. */
export async function titreExiste(siteId: string, titre: string, saufId?: string) {
  const rows = await prisma.article.findMany({ where: { siteId, ...(saufId && { id: { not: saufId } }) }, select: { titre: true } });
  const n = normName(titre);
  return rows.some((r) => normName(r.titre) === n);
}

async function contexteSite(siteId: string) {
  const s = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, include: { client: { select: { name: true, address: true, secteur: true, phone: true, email: true } }, articles: { where: { statut: "PUBLIE" }, select: { titre: true, url: true }, orderBy: { publieAt: "desc" }, take: 12 } } });
  const ville = s.client.address?.split(",").pop()?.replace(/\d{5}/, "").trim() || "";
  return { s, ville };
}

/** Rédige un article (IA, sous interrupteur « blog ») avec les règles SEO, maillage interne et référencement local. */
export async function redigerArticle(articleId: string, userId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await prisma.article.findUnique({ where: { id: articleId } });
  if (!a) return { ok: false, error: "Article introuvable." };
  const ok = await iaAutorisee("blog");
  if (!ok.ok) return { ok: false, error: ok.raison };
  const { s, ville } = await contexteSite(a.siteId);
  const pages = s.url ? ["Accueil", "Services", "Contact"].map((p) => `${p} : ${s.url}${p === "Accueil" ? "" : p === "Services" ? "/services" : "/contact"}`).join(" ; ") : "pages du site (accueil, services, contact)";
  const system = `Tu rédiges des articles de blog en français pour le site d'un commerçant ou artisan, client de l'agence ACCO LAB. Règles strictes :
- Structure : titre H1 accrocheur, introduction courte, 3 à 5 sections avec H2, conclusion avec appel à l'action vers le contact du commerce. 600 à 900 mots. Format markdown.
- SEO : un mot-clé principal et 3 à 5 mots-clés secondaires naturels, meta description de 150 caractères en fin d'article sous « Meta description : ».
- Référencement local : cite la ville et le secteur géographique de l'entreprise (${ville || "sa ville"}) de façon naturelle, au moins 3 fois, et le nom de l'entreprise.
- Maillage interne : insère 2 à 3 liens markdown vers les pages du site : ${pages}. Ne cite aucun article déjà publié ci-dessous comme nouveau sujet, mais tu peux y faire un lien s'il est pertinent.
- Ton : simple, concret, utile pour un client final ; pas de jargon, aucune promesse invérifiable, aucun chiffre inventé.
- Termine par une ligne « Mots-clés : … ».`;
  const user = `Entreprise : ${s.client.name}${s.client.secteur ? ` (${s.client.secteur})` : ""}${s.client.address ? `, ${s.client.address}` : ""}. Site : ${s.url ?? s.name}.
Sujet demandé : ${a.titre}${a.consignes ? `\nConsignes : ${a.consignes}` : ""}
Articles déjà publiés : ${s.articles.map((x) => x.titre).join(" | ") || "aucun"}`;
  const texte = await texteIA("blog", system, user, 2500, userId);
  if (!texte) return { ok: false, error: "Rédaction indisponible (IA coupée ou plafond atteint)." };
  const mots = /Mots-clés\s*:\s*(.+)$/im.exec(texte)?.[1]?.trim() ?? null;
  await prisma.article.update({ where: { id: articleId }, data: { contenu: texte, motsCles: mots, genereParIA: true, statut: a.statut === "A_REDIGER" ? "REDIGE" : a.statut, auteurId: userId ?? a.auteurId } });
  await logActivite({ kind: "article", texte: `Article rédigé (IA) pour ${s.name} : ${a.titre}`, href: `/admin/blog/${a.siteId}`, userId, clientId: s.clientId, siteId: a.siteId });
  return { ok: true };
}

/** Prévoit un article rédigé pour le prochain lundi libre. */
export async function planifierArticle(articleId: string, userId: string | null): Promise<{ ok: true; lundi: Date } | { ok: false; error: string }> {
  const a = await prisma.article.findUnique({ where: { id: articleId } });
  if (!a) return { ok: false, error: "Article introuvable." };
  if (a.statut === "PUBLIE") return { ok: false, error: "Déjà publié." };
  if (!a.contenu) return { ok: false, error: "Rédigez l’article avant de le prévoir." };
  if (await titreExiste(a.siteId, a.titre, a.id)) return { ok: false, error: "Un article avec ce titre existe déjà pour ce site (doublon)." };
  const lundi = await prochainLundiLibre(a.siteId);
  await prisma.article.update({ where: { id: articleId }, data: { statut: "A_PUBLIER", prevuPour: lundi } });
  const s = await prisma.site.findUnique({ where: { id: a.siteId }, select: { name: true, clientId: true } });
  await logActivite({ kind: "article", texte: `Article prévu pour ${fmtLundi(lundi)} sur ${s?.name ?? ""} : ${a.titre}`, href: `/admin/blog/${a.siteId}`, userId, clientId: s?.clientId, siteId: a.siteId });
  return { ok: true, lundi };
}

/** Marque un article publié (URL), un seul par lundi : la date de publication devient le lundi prévu si c'est la même semaine. */
export async function publierArticle(articleId: string, url: string | null, userId: string | null) {
  const a = await prisma.article.findUnique({ where: { id: articleId } });
  if (!a) return;
  const now = new Date();
  await prisma.article.update({ where: { id: articleId }, data: { statut: "PUBLIE", url: url || a.url, publieAt: now, prevuPour: a.prevuPour ?? dernierLundi(now) } }).catch(async () => prisma.article.update({ where: { id: articleId }, data: { statut: "PUBLIE", url: url || a.url, publieAt: now } }));
  const s = await prisma.site.findUnique({ where: { id: a.siteId }, select: { name: true, clientId: true } });
  await logActivite({ kind: "article", texte: `Article publié sur ${s?.name ?? ""} : ${a.titre}`, href: `/admin/blog/${a.siteId}`, userId, clientId: s?.clientId, siteId: a.siteId });
}

/** Propose un sujet (IA) non encore traité et le met dans la file « blogs demandés ». */
export async function proposerSujet(siteId: string, userId: string | null): Promise<{ ok: true; titre: string } | { ok: false; error: string }> {
  const ok = await iaAutorisee("blog");
  if (!ok.ok) return { ok: false, error: ok.raison };
  const { s, ville } = await contexteSite(siteId);
  const existants = await prisma.article.findMany({ where: { siteId }, select: { titre: true } });
  const texte = await texteIA("blog", "Tu proposes UN seul titre d'article de blog (une ligne, sans guillemets, sans numéro) pour le site d'un commerçant ou artisan, utile pour ses clients, optimisé pour le référencement local (ville) et différent des sujets déjà traités.", `Entreprise : ${s.client.name}${s.client.secteur ? ` (${s.client.secteur})` : ""}, ville : ${ville || "inconnue"}.\nSujets déjà traités : ${existants.map((x) => x.titre).join(" | ") || "aucun"}`, 120, userId);
  const titre = texte?.split("\n")[0]?.replace(/^["«»\s-]+|["«»\s]+$/g, "").trim();
  if (!titre) return { ok: false, error: "Aucun sujet proposé (IA coupée ou plafond atteint)." };
  if (await titreExiste(siteId, titre)) return { ok: false, error: `Sujet déjà traité : ${titre}` };
  await prisma.article.create({ data: { siteId, titre, genereParIA: true, auteurId: userId } });
  return { ok: true, titre };
}

/**
 * Automatisation (case par site) : s'assure qu'un article est prévu pour le prochain lundi ; sinon prend le plus ancien demandé
 * (ou rédigé), le rédige si besoin, et le prévoit. Sans demande, propose un sujet. Journalise les problèmes.
 */
export async function automatiserBlogs(now = new Date()) {
  const sites = (await sitesAvecBlog()).filter((s) => s.blogAuto);
  let prevus = 0;
  for (const s of sites) {
    const cle = `blog_probleme:${s.id}`;
    try {
      const e = await etatBlog(s.id, now);
      if (e.prochain) continue;
      let a = e.rediges[0] ?? e.demandes[0] ?? null;
      if (!a) { const p = await proposerSujet(s.id, null); if (!p.ok) throw new Error(p.error); a = (await prisma.article.findFirst({ where: { siteId: s.id, statut: "A_REDIGER" }, orderBy: { createdAt: "desc" } }))!; }
      if (!a.contenu) { const r = await redigerArticle(a.id, null); if (!r.ok) throw new Error(r.error); }
      const pl = await planifierArticle(a.id, null);
      if (!pl.ok) throw new Error(pl.error);
      prevus++;
      await prisma.setting.deleteMany({ where: { key: cle } });
    } catch (err) {
      await prisma.setting.upsert({ where: { key: cle }, create: { key: cle, value: `${new Date().toISOString()} ${(err as Error).message}` }, update: { value: `${new Date().toISOString()} ${(err as Error).message}` } });
    }
  }
  return { sites: sites.length, prevus };
}
export async function problemeBlog(siteId: string) {
  const r = await prisma.setting.findUnique({ where: { key: `blog_probleme:${siteId}` } });
  return r ? r.value.replace(/^\S+\s/, "") : null;
}

/** Alerte du lundi (18 h) et du mardi : rien publié le dernier lundi → notification aux développeurs du site et à Arsène, une fois par lundi. */
export async function alertesBlog(now = new Date()) {
  const jour = jourParis(now).getUTCDay(); // 1 = lundi, 2 = mardi
  const heure = Number(now.toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", hour12: false }));
  if (!((jour === 1 && heure >= 18) || jour === 2)) return { alertes: 0 };
  const sites = await sitesAvecBlog();
  const gestionnaires = await prisma.user.findMany({ where: { email: { in: gestionnaireEmails() } }, select: { id: true } });
  let alertes = 0;
  for (const s of sites) {
    const e = await etatBlog(s.id, now);
    if (!e.enRetard) continue;
    const cle = `blog_alerte:${s.id}:${e.dernierLundi.toISOString().slice(0, 10)}`;
    if (await prisma.setting.findUnique({ where: { key: cle } })) continue;
    const cibles = new Set([s.developpeurId, s.client.developpeurId, ...gestionnaires.map((g) => g.id)].filter((x): x is string => !!x));
    for (const id of cibles) await sendPushToUser(id, { title: `Blog non publié : ${s.name}`, body: `Aucun article publié le ${fmtLundi(e.dernierLundi)}.`, url: `/admin/blog/${s.id}`, tag: cle }).catch(() => null);
    await logActivite({ kind: "article", texte: `${s.name} : aucun article de blog publié le ${fmtLundi(e.dernierLundi)}`, href: `/admin/blog/${s.id}`, clientId: s.clientId, siteId: s.id });
    await prisma.setting.create({ data: { key: cle, value: new Date().toISOString() } });
    alertes++;
  }
  return { alertes };
}
export function startBlogTicker() {
  const g = globalThis as { __blogTicker?: NodeJS.Timeout };
  if (g.__blogTicker) return;
  const tick = () => Promise.all([automatiserBlogs(), publierBlogsDuLundi(), suivrePublications(), alertesBlog()]).catch((e) => console.warn("[blog]", (e as Error).message));
  setTimeout(tick, 150_000);
  g.__blogTicker = setInterval(tick, 10 * 60_000);
}

/** Adresse publique prévue d'un article (le worker crée la page à cet emplacement exact). */
export const urlArticle = (siteUrl: string | null, titre: string) => (siteUrl ? `${siteUrl.replace(/\/$/, "")}/blog/${slugDe(titre)}.html` : null);

export function consignesPublication(a: { titre: string; contenu: string | null; motsCles: string | null }, siteUrl: string | null) {
  const slug = slugDe(a.titre);
  return `PUBLICATION AUTOMATIQUE D'UN ARTICLE DE BLOG (portail Acco). À faire exactement :
1. Crée la page de l'article à l'emplacement blog/${slug}.html (depuis la racine servie du site). Si le site a déjà un dossier ou une convention de blog (ex. blog/index.html, articles/, posts/), respecte-la et garde le nom ${slug}.
2. Reprends le style du site (même en-tête, pied de page, feuille de style, polices) pour que la page soit intégrée. Pas de nouveau framework.
3. Convertis le texte markdown ci-dessous en HTML propre : h1 pour le titre, h2 pour les sections, paragraphes, liens tels quels. Place la « Meta description » dans <meta name="description">, le titre dans <title>, et ajoute les balises Open Graph de base.
4. Ajoute un lien vers l'article sur la page d'accueil ou la page de liste du blog (crée blog/index.html listant les articles si elle n'existe pas), avec la date du jour.
5. Si le dépôt contient blog/_cocon.md, relie l'article à sa page pilier (lien dans le texte avec une ancre contenant le mot-clé) et ajoute un lien vers l'article depuis cette page pilier, en respectant le cocon sémantique.
6. Ne modifie rien d'autre. Pas de fichier de configuration, pas de déploiement.
Adresse publique attendue : ${urlArticle(siteUrl, a.titre) ?? `/blog/${slug}.html`}
${a.motsCles ? `Mots-clés : ${a.motsCles}\n` : ""}
--- ARTICLE (markdown) ---
${a.contenu ?? ""}`;
}

/**
 * Lundi dès 6 h (Paris) : chaque article prévu pour ce lundi est confié au worker Claude du Mac, qui l'intègre au dépôt GitHub du
 * site ; le VPS publie dans la minute. Aucune validation humaine : la mise en ligne est demandée dès que la branche est prête.
 */
export async function publierBlogsDuLundi(now = new Date()) {
  const jour = jourParis(now).getUTCDay();
  const heure = Number(now.toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", hour12: false }));
  if (jour !== 1 || heure < 6) return { confies: 0 };
  const lundi = dernierLundi(now);
  const articles = await prisma.article.findMany({ where: { statut: "A_PUBLIER", prevuPour: lundi, changeRequestId: null }, include: { site: { select: { id: true, name: true, url: true, repoUrl: true, clientId: true, developpeurId: true } } } });
  let confies = 0;
  for (const a of articles) {
    const cle = `blog_probleme:${a.siteId}`;
    if (!a.site.repoUrl) { await prisma.setting.upsert({ where: { key: cle }, create: { key: cle, value: `${new Date().toISOString()} Dépôt GitHub non renseigné sur la fiche du site : publication impossible.` }, update: { value: `${new Date().toISOString()} Dépôt GitHub non renseigné sur la fiche du site : publication impossible.` } }); continue; }
    if (!a.contenu) continue;
    const cr = await prisma.changeRequest.create({ data: { siteId: a.siteId, title: `Article de blog : ${a.titre}`, description: consignesPublication(a, a.site.url), page: "Blog", status: "EN_COURS", assigneeId: a.site.developpeurId, startedAt: new Date(), claudeState: "EN_FILE" } });
    await prisma.article.update({ where: { id: a.id }, data: { changeRequestId: cr.id, url: a.url ?? urlArticle(a.site.url, a.titre) } });
    await logActivite({ kind: "article", texte: `${a.site.name} : publication de « ${a.titre} » confiée à Claude (dépôt GitHub)`, href: `/admin/blog/${a.siteId}`, clientId: a.site.clientId, siteId: a.siteId });
    confies++;
  }
  return { confies };
}

/** Suit les publications confiées au worker : branche prête → mise en ligne demandée ; en ligne → article publié ; erreur → alerte. */
export async function suivrePublications() {
  const enCours = await prisma.article.findMany({ where: { statut: "A_PUBLIER", changeRequestId: { not: null } }, include: { site: { select: { id: true, name: true, url: true, clientId: true, developpeurId: true, client: { select: { developpeurId: true } } } } } });
  if (enCours.length === 0) return { suivis: 0 };
  const heartbeat = await prisma.setting.findUnique({ where: { key: WORKER_HEARTBEAT_KEY } });
  const macOk = workerOnline(heartbeat?.value);
  const gestionnaires = await prisma.user.findMany({ where: { email: { in: gestionnaireEmails() } }, select: { id: true } });
  for (const a of enCours) {
    const cr = await prisma.changeRequest.findUnique({ where: { id: a.changeRequestId! }, select: { claudeState: true, claudeError: true, claudeSummary: true } });
    const cle = `blog_probleme:${a.siteId}`;
    const probleme = async (msg: string) => {
      const deja = await prisma.setting.findUnique({ where: { key: cle } });
      await prisma.setting.upsert({ where: { key: cle }, create: { key: cle, value: `${new Date().toISOString()} ${msg}` }, update: { value: `${new Date().toISOString()} ${msg}` } });
      if (!deja || !deja.value.endsWith(msg)) for (const id of new Set([a.site.developpeurId, a.site.client.developpeurId, ...gestionnaires.map((g) => g.id)].filter((x): x is string => !!x))) await sendPushToUser(id, { title: `Blog non publié : ${a.site.name}`, body: msg, url: `/admin/blog/${a.siteId}`, tag: `blog-pb-${a.id}` }).catch(() => null);
    };
    if (!cr) { await prisma.article.update({ where: { id: a.id }, data: { changeRequestId: null } }); continue; }
    if (cr.claudeState === "PRET") { await prisma.changeRequest.update({ where: { id: a.changeRequestId! }, data: { claudeState: "MISE_EN_LIGNE_DEMANDEE", status: "EN_COURS" } }); continue; }
    if (cr.claudeState === "EN_LIGNE") {
      await prisma.article.update({ where: { id: a.id }, data: { statut: "PUBLIE", publieAt: new Date(), url: a.url ?? urlArticle(a.site.url, a.titre) } });
      await prisma.setting.deleteMany({ where: { key: cle } });
      await logActivite({ kind: "article", texte: `Article publié automatiquement sur ${a.site.name} : ${a.titre}`, href: `/admin/blog/${a.siteId}`, clientId: a.site.clientId, siteId: a.siteId });
      continue;
    }
    if (cr.claudeState === "ERREUR") { await probleme(`Échec de la publication par Claude : ${cr.claudeError ?? cr.claudeSummary ?? "erreur"}`); continue; }
    if (!macOk && (cr.claudeState === "EN_FILE" || cr.claudeState === "MISE_EN_LIGNE_DEMANDEE")) await probleme("Le Mac (worker Claude) est hors ligne : la publication attend.");
  }
  return { suivis: enCours.length };
}
export const consignesPublicationExport = consignesPublication;
