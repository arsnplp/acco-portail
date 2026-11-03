/**
 * Vérification automatique avant mise en ligne (10.6) : le script parcourt le site (préprod ou prod) et contrôle ce qui peut l'être.
 * Arsène ne coche que ce que la machine a confirmé ; le reste (dernière version validée par le client, sécurité) reste manuel.
 */
import { prisma } from "@/lib/prisma";

export type Verif = { key: string; label: string; ok: boolean | null; detail: string };
export type RapportQA = { at: string; base: string; pages: number; verifs: Verif[]; ok: boolean };

const TIMEOUT = 12_000;
async function get(url: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT), headers: { "user-agent": "AccoQA/1 (+https://acco-lab.fr)" }, cache: "no-store" });
    const html = res.headers.get("content-type")?.includes("html") ? await res.text() : "";
    return { status: res.status, html, ms: Date.now() - t0, finalUrl: res.url };
  } catch (e) { return { status: 0, html: "", ms: Date.now() - t0, finalUrl: url, erreur: (e as Error).message }; }
}
const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1] ?? null;
const tags = (html: string, tag: string) => html.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) ?? [];
const texte = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

export async function verifierSite(siteId: string): Promise<RapportQA> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { url: true, previewUrl: true, siteKey: true, client: { select: { name: true, phone: true, address: true } } } });
  const base = (site.url ?? site.previewUrl ?? "").replace(/\/$/, "");
  if (!base) return { at: new Date().toISOString(), base: "", pages: 0, verifs: [{ key: "base", label: "Adresse du site", ok: false, detail: "Ni URL ni lien de prévisualisation sur la fiche du site." }], ok: false };
  const origin = new URL(base).origin;
  const accueil = await get(base);
  const liens = [...new Set([...accueil.html.matchAll(/href\s*=\s*["']([^"'#?]+)["']/gi)].map((m) => m[1]).map((h) => { try { return new URL(h, base).href; } catch { return null; } }).filter((u): u is string => !!u))];
  const internes = liens.filter((u) => u.startsWith(origin) && !/\.(pdf|jpg|jpeg|png|webp|svg|gif|css|js|ico|xml|txt|zip)$/i.test(u)).slice(0, 25);
  const pages = [{ url: base, ...accueil }, ...(await Promise.all(internes.filter((u) => u !== accueil.finalUrl && u !== base && u !== base + "/").map(async (u) => ({ url: u, ...(await get(u)) }))))];
  const htmlPages = pages.filter((p) => p.html);
  const externes = liens.filter((u) => !u.startsWith(origin)).slice(0, 30);
  const casses: string[] = [];
  for (const p of pages) if (p.status === 0 || p.status >= 400) casses.push(`${p.url} (${p.status || "injoignable"})`);
  for (const u of externes) { const r = await fetch(u, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) }).catch(() => null); if (r && r.status >= 400) casses.push(`${u} (${r.status})`); }
  const sansTitle = htmlPages.filter((p) => !/<title>[^<]{3,}<\/title>/i.test(p.html)).map((p) => p.url);
  const sansDesc = htmlPages.filter((p) => !tags(p.html, "meta").some((t) => /name\s*=\s*["']description["']/i.test(t) && (attr(t, "content") ?? "").length > 30)).map((p) => p.url);
  const h1 = htmlPages.filter((p) => (p.html.match(/<h1\b/gi) ?? []).length !== 1).map((p) => p.url);
  const sansAlt = htmlPages.flatMap((p) => tags(p.html, "img").filter((t) => attr(t, "alt") === null).map(() => p.url));
  const viewport = htmlPages.filter((p) => !tags(p.html, "meta").some((t) => /name\s*=\s*["']viewport["']/i.test(t))).map((p) => p.url);
  const lang = /<html[^>]*\blang\s*=/i.test(accueil.html);
  const lents = pages.filter((p) => p.ms > 3000).map((p) => `${p.url} (${p.ms} ms)`);
  const tout = texte(htmlPages.map((p) => p.html).join(" ")).toLowerCase();
  const toutHtml = htmlPages.map((p) => p.html).join(" ");
  const mentions = /mentions?\s+l[ée]gales?/i.test(toutHtml) && liens.some((u) => /mention/i.test(u));
  const confidentialite = /confidentialit[ée]|donn[ée]es personnelles|rgpd/i.test(toutHtml);
  const backlink = /acco-lab\.fr/i.test(accueil.html) && /acco/i.test(texte(accueil.html.slice(-6000)));
  const formulaire = site.siteKey ? toutHtml.includes(site.siteKey) : null;
  const telephone = site.client.phone ? tout.replace(/[\s.]/g, "").includes(site.client.phone.replace(/[\s.]/g, "")) : null;
  const adresse = site.client.address ? tout.includes(site.client.address.split(",")[0].toLowerCase()) : null;
  const https = /^https:/.test(base);
  const verifs: Verif[] = [
    { key: "liens", label: "Tous les liens et menus fonctionnent", ok: casses.length === 0, detail: casses.length ? `${casses.length} lien(s) cassé(s) : ${casses.slice(0, 3).join(", ")}` : `${pages.length} page(s) et ${externes.length} lien(s) externe(s) testés` },
    { key: "responsive", label: "Responsive (balise viewport sur chaque page)", ok: viewport.length === 0, detail: viewport.length ? `Sans viewport : ${viewport.slice(0, 3).join(", ")}` : "OK" },
    { key: "title", label: "Chaque page a un titre", ok: sansTitle.length === 0, detail: sansTitle.length ? `Sans titre : ${sansTitle.slice(0, 3).join(", ")}` : "OK" },
    { key: "description", label: "Chaque page a une meta description (SEO)", ok: sansDesc.length === 0, detail: sansDesc.length ? `Manque : ${sansDesc.slice(0, 3).join(", ")}` : "OK" },
    { key: "h1", label: "Un seul H1 par page (SEO)", ok: h1.length === 0, detail: h1.length ? `À corriger : ${h1.slice(0, 3).join(", ")}` : "OK" },
    { key: "alt", label: "Images avec attribut alt (SEO, accessibilité)", ok: sansAlt.length === 0, detail: sansAlt.length ? `${sansAlt.length} image(s) sans alt` : "OK" },
    { key: "lang", label: "Langue déclarée sur la page (html lang)", ok: lang, detail: lang ? "OK" : "Ajouter lang=\"fr\" sur <html>" },
    { key: "mentions", label: "Mentions légales présentes et liées", ok: mentions, detail: mentions ? "OK" : "Pas de page ou de lien « Mentions légales »" },
    { key: "confidentialite", label: "Politique de confidentialité / RGPD", ok: confidentialite, detail: confidentialite ? "OK" : "Aucune mention de confidentialité ou de données personnelles" },
    { key: "backlink", label: "Mention « Réalisé par Acco » avec lien vers acco-lab.fr en pied de page", ok: backlink, detail: backlink ? "OK" : "Lien acco-lab.fr absent du pied de page de l’accueil" },
    { key: "formulaire", label: "Formulaire de contact relié à l’app (clé du site)", ok: formulaire, detail: formulaire === null ? "Pas de clé formulaire" : formulaire ? "OK" : "La clé du site n’apparaît dans aucune page : le formulaire n’enverra rien à l’app" },
    { key: "telephone", label: "Téléphone du client affiché", ok: telephone, detail: telephone === null ? "Téléphone non renseigné sur la fiche client" : telephone ? "OK" : "Le téléphone de la fiche client n’apparaît pas sur le site" },
    { key: "adresse", label: "Adresse du client affichée (référencement local)", ok: adresse, detail: adresse === null ? "Adresse non renseignée sur la fiche client" : adresse ? "OK" : "L’adresse de la fiche client n’apparaît pas sur le site" },
    { key: "https", label: "HTTPS", ok: https, detail: https ? "OK" : "Le site n’est pas en https" },
    { key: "performance", label: "Pages servies en moins de 3 s", ok: lents.length === 0, detail: lents.length ? lents.slice(0, 3).join(", ") : `Accueil en ${accueil.ms} ms` },
  ];
  const rapport: RapportQA = { at: new Date().toISOString(), base, pages: pages.length, verifs, ok: verifs.every((v) => v.ok !== false) };
  await prisma.setting.upsert({ where: { key: `qa:${siteId}` }, create: { key: `qa:${siteId}`, value: JSON.stringify(rapport) }, update: { value: JSON.stringify(rapport) } });
  return rapport;
}
export async function dernierRapportQA(siteId: string): Promise<RapportQA | null> {
  const r = await prisma.setting.findUnique({ where: { key: `qa:${siteId}` } });
  return r ? (JSON.parse(r.value) as RapportQA) : null;
}
