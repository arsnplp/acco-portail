import { JWT } from "google-auth-library";
import { connectedGoogleClient } from "@/lib/google-oauth";

export type MonthStats = { clicks: number; impressions: number; position: number; topQueries: { query: string; clicks: number; impressions: number; position: number }[] };

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as { client_email: string; private_key: string };
    return new JWT({ email: sa.client_email, key: sa.private_key.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
  } catch {
    console.warn("[search-console] GOOGLE_SERVICE_ACCOUNT_JSON illisible");
    return null;
  }
}

/** Client Google utilisable : compte Acco connecté (OAuth) sinon compte de service, sinon null (mode démo). */
export async function googleClient() {
  return (await connectedGoogleClient()) ?? serviceAccount();
}

export const searchConsoleConfigured = async () => Boolean(await googleClient());

/** Propriétés Search Console accessibles avec le compte connecté. */
export async function listProperties() {
  const client = await googleClient();
  if (!client) return [];
  try {
    const res = await client.request<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>({ url: "https://searchconsole.googleapis.com/webmasters/v3/sites" });
    return (res.data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl).sort();
  } catch (e) {
    console.warn("[search-console] liste des propriétés impossible :", (e as Error).message);
    return [];
  }
}

/** Email du compte de service à ajouter comme utilisateur sur chaque propriété Search Console. */
export function serviceAccountEmail() {
  try { return (JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}") as { client_email?: string }).client_email ?? null; } catch { return null; }
}

const pad = (n: number) => String(n).padStart(2, "0");
export function monthBounds(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  return { startDate: `${year}-${pad(month)}-01`, endDate: `${year}-${pad(month)}-${pad(last)}` };
}

/** Chiffres d'un mois pour une propriété (ex. sc-domain:monsite.fr ou https://monsite.fr/). */
export async function fetchMonthStats(property: string, year: number, month: number): Promise<MonthStats | null> {
  const client = await googleClient();
  if (!client) return null;
  const { startDate, endDate } = monthBounds(year, month);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const totals = await client.request<{ rows?: { clicks: number; impressions: number; position: number }[] }>({ url, method: "POST", data: { startDate, endDate, dimensions: [], rowLimit: 1 } });
  const queries = await client.request<{ rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] }>({ url, method: "POST", data: { startDate, endDate, dimensions: ["query"], rowLimit: 10, orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }] } });
  const t = totals.data.rows?.[0] ?? { clicks: 0, impressions: 0, position: 0 };
  return {
    clicks: Math.round(t.clicks),
    impressions: Math.round(t.impressions),
    position: Math.round(t.position * 10) / 10,
    topQueries: (queries.data.rows ?? []).map((r) => ({ query: r.keys[0], clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), position: Math.round(r.position * 10) / 10 })),
  };
}

/** Données de démonstration plausibles et stables (sans accès Google). */
export function demoMonthStats(seed: string, year: number, month: number): MonthStats {
  let h = 0;
  for (const c of `${seed}-${year}-${month}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 2 ** 32; };
  const growth = 1 + ((year - 2025) * 12 + month) * 0.02;
  const clicks = Math.round((120 + rnd() * 80) * growth);
  const impressions = Math.round(clicks * (14 + rnd() * 6));
  const position = Math.round((9 + rnd() * 6 - growth) * 10) / 10;
  const base = seed.includes("traiteur") ? ["traiteur paris 9", "traiteur mariage paris", "buffet entreprise", "plateaux repas", "traiteur événement"] : ["boulangerie paris 9", "boulangerie rue des martyrs", "meilleure baguette paris", "pâtisserie paris 9", "pain au levain paris"];
  const topQueries = base.map((q, i) => { const c = Math.round(clicks * (0.22 - i * 0.035) * (0.8 + rnd() * 0.4)); return { query: q, clicks: c, impressions: Math.round(c * (8 + rnd() * 10)), position: Math.round((2 + i * 1.6 + rnd() * 2) * 10) / 10 }; });
  return { clicks, impressions, position, topQueries };
}
