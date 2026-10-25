/** Audit rapide du site d'un lead : HTTPS, mobile, CMS, hébergeur, âge du domaine, faiblesses SEO visibles. */
import { hostOf } from "./texte";

export type Audit = {
  cms: string | null; hebergeur: string | null; https: "Oui" | "Non" | null; responsive: "Oui" | "Non" | null; ageDomaine: string | null;
  scoreSeo: number; faiblesses: string[]; vitesseMobile: number | null; vitesseDesktop: number | null; joignable: boolean;
};

const UA = "Mozilla/5.0 (compatible; AccoLeadAudit/1.0; +https://acco-lab.fr)";
const CMS: [RegExp, string, string | null][] = [
  [/planity/i, "Planity (site vitrine généré)", "Planity"],
  [/wp-content|wp-includes|wordpress/i, "WordPress", null],
  [/wix\.com|wixstatic|_wixCssImports/i, "Wix", "Wix"],
  [/cdn\.shopify|shopify/i, "Shopify", "Shopify"],
  [/squarespace/i, "Squarespace", "Squarespace"],
  [/webflow/i, "Webflow", "Webflow"],
  [/jimdo/i, "Jimdo", "Jimdo"],
  [/e-monsite/i, "e-monsite", "e-monsite"],
  [/site123/i, "SITE123", "SITE123"],
  [/godaddy|img1\.wsimg/i, "GoDaddy Website Builder", "GoDaddy"],
  [/sites\.google|googleusercontent\.com\/sites/i, "Google Sites", "Google"],
  [/prestashop/i, "PrestaShop", null],
  [/joomla/i, "Joomla", null],
  [/treatwell/i, "Treatwell", "Treatwell"],
];

function pick(html: string, re: RegExp) { return re.exec(html)?.[1]?.trim() ?? null; }

async function domainAge(host: string) {
  try {
    const res = await fetch(`https://rdap.org/domain/${host.split(".").slice(-2).join(".")}`, { signal: AbortSignal.timeout(6000), redirect: "follow" });
    if (!res.ok) return null;
    const j = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
    const reg = j.events?.find((e) => e.eventAction === "registration")?.eventDate;
    if (!reg) return null;
    const years = Math.floor((Date.now() - Date.parse(reg)) / (365.25 * 86400_000));
    return years < 1 ? "moins d’1 an" : `${years} an${years > 1 ? "s" : ""}`;
  } catch { return null; }
}

async function pagespeed(url: string, strategy: "mobile" | "desktop") {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null; // optionnel : sans clé Google, colonne vide (trop lent sans quota)
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${new URLSearchParams({ url, strategy, category: "performance", key })}`, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { lighthouseResult?: { categories?: { performance?: { score?: number } } } };
    const s = j.lighthouseResult?.categories?.performance?.score;
    return typeof s === "number" ? Math.round(s * 100) : null;
  } catch { return null; }
}

export async function auditSite(url: string | null, ville: string | null): Promise<Audit> {
  const empty: Audit = { cms: null, hebergeur: null, https: null, responsive: null, ageDomaine: null, scoreSeo: 0, faiblesses: ["Pas de site web"], vitesseMobile: null, vitesseDesktop: null, joignable: false };
  const host = hostOf(url);
  if (!url || !host) return empty;
  const full = /^https?:\/\//.test(url) ? url : `https://${url}`;
  let res: Response | null = null, html = "";
  try {
    res = await fetch(full, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
    html = (await res.text()).slice(0, 600_000);
  } catch {
    try { res = await fetch(full.replace(/^https:/, "http:"), { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8000) }); html = (await res.text()).slice(0, 600_000); } catch { /* injoignable */ }
  }
  const [age, vm, vd] = await Promise.all([domainAge(host), pagespeed(full, "mobile"), pagespeed(full, "desktop")]);
  if (!res || !html) return { ...empty, faiblesses: ["Site injoignable"], ageDomaine: age };

  const finalUrl = res.url || full;
  const https = finalUrl.startsWith("https://") ? "Oui" : "Non";
  const responsive = /<meta[^>]+name=["']viewport["']/i.test(html) ? "Oui" : "Non";
  const found = CMS.find(([re]) => re.test(html));
  const server = res.headers.get("server") ?? res.headers.get("x-powered-by");
  const hebergeur = found?.[2] ?? (server && /ovh/i.test(server) ? "OVH" : server && /o2switch/i.test(server) ? "o2switch" : server && /cloudflare/i.test(server) ? "Cloudflare" : server && /ionos|1&1/i.test(server) ? "IONOS" : server && /hostinger/i.test(server) ? "Hostinger" : null);
  const title = pick(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) ?? pick(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const h1 = /<h1[\s>]/i.test(html);
  const tel = /href=["']tel:/i.test(html);
  const maintenance = /maintenance|under construction|en construction|coming soon|bient[oô]t disponible/i.test(title ?? "") || (/maintenance|under construction/i.test(html) && html.length < 8000);

  const faiblesses: string[] = [];
  if (maintenance) faiblesses.push("Site en maintenance ou en construction");
  if (https === "Non") faiblesses.push("Pas de HTTPS");
  if (responsive === "Non") faiblesses.push("Pas adapté au mobile");
  const villeMot = ville?.replace(/^\d{5}\s*/, "").split(/[\s-]/)[0]?.toLowerCase();
  if (!title || title.length < 15) faiblesses.push("Title absent ou trop court");
  else if (villeMot && !title.toLowerCase().includes(villeMot)) faiblesses.push("Title sans la ville");
  if (!description) faiblesses.push("Pas de meta description");
  if (!h1) faiblesses.push("Pas de titre H1");
  if (!tel) faiblesses.push("Téléphone non cliquable");
  if (found && ["Planity", "Treatwell"].includes(found[2] ?? "")) faiblesses.push("Simple page de réservation, pas un vrai site");
  const scoreSeo = Math.max(0, 5 - faiblesses.length);

  return { cms: found?.[1] ?? null, hebergeur, https, responsive, ageDomaine: age, scoreSeo, faiblesses, vitesseMobile: vm, vitesseDesktop: vd, joignable: true };
}
