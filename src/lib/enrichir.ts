/**
 * « Générer les infos » : enrichit une fiche créée à la main avec les mêmes 34 colonnes qu'un lead du coffre.
 * Registre officiel (SIREN, dirigeant…), audit du site, et si une clé Anthropic est présente, une recherche web
 * (fiche Google, note et avis, réseaux). Les champs vides de la fiche (SIREN, SIRET, dirigeant, site, adresse) sont complétés.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lookupRegistre } from "@/lib/leads/registre";
import { auditSite } from "@/lib/leads/audit";
import { anthropicKey, row, type Trouve } from "@/lib/leads/generate";
import type { LeadRow } from "@/lib/leads/colonnes";

const MODEL = process.env.LEADS_MODEL ?? "claude-sonnet-5-5";

const PROMPT = `Tu es chargé de recherche B2B pour une agence web française. On te donne UNE entreprise locale (nom, adresse, téléphone, site connus). Cherche sur le web (fiche Google Maps, Pages Jaunes, Planity, Facebook, Instagram, site officiel) et renvoie ce que tu trouves sur CETTE entreprise précisément (même nom, même ville). Zéro invention : information introuvable = null.
Termine par un unique bloc \`\`\`json :
{"entreprise":"nom commercial","secteur":"métier en minuscules","code_postal":"13100","ville":"Aix-en-Provence","adresse":"numéro, rue, code postal ville","telephone":"06 12 34 56 78","email":null,"site_web":"https://… ou null (le site propre de l'entreprise uniquement)","note_google":4.8,"avis_google":120,"facebook":"URL ou null","instagram":"URL ou null","fiche_google":"lien exact de la fiche Google Maps ou null","google_ads":null,"presence":"sans site | site faible | site correct","source":"pages consultées et remarque utile"}`;

async function rechercheWeb(p: { societe: string; adresse: string | null; telephone: string | null; siteWeb: string | null }): Promise<Trouve | null> {
  const key = await anthropicKey();
  if (!key) return null;
  const client = new Anthropic({ apiKey: key, timeout: 4 * 60_000 });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Entreprise : ${p.societe}\nAdresse connue : ${p.adresse ?? "inconnue"}\nTéléphone connu : ${p.telephone ?? "inconnu"}\nSite connu : ${p.siteWeb ?? "inconnu"}` }];
  const outil = (type: string) => [{ type, name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" } }] as unknown as Anthropic.ToolUnion[];
  let tools = outil("web_search_20260318"), text = "";
  for (let tour = 0; tour < 6; tour++) {
    let res: Anthropic.Message;
    try {
      res = await client.messages.create({ model: MODEL, max_tokens: 4000, system: PROMPT, tools, messages });
    } catch (e) {
      if (tour === 0 && /web_search|tool|invalid_request/i.test((e as Error).message) && !/credit|authentication|api.key/i.test((e as Error).message)) { tools = outil("web_search_20250305"); res = await client.messages.create({ model: MODEL, max_tokens: 4000, system: PROMPT, tools, messages }); }
      else throw e;
    }
    text = res.content.filter((c) => c.type === "text").map((c) => (c as Anthropic.TextBlock).text).join("\n");
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  const block = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { const t = JSON.parse(block) as Trouve; return t?.entreprise ? t : null; } catch { return null; }
}

export async function enrichirProspect(id: string): Promise<{ ok: true; infos: LeadRow; web: boolean } | { ok: false; error: string }> {
  const p = await prisma.prospect.findUnique({ where: { id }, include: { contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1 } } });
  if (!p) return { ok: false, error: "Fiche introuvable." };
  const cp = /\b(\d{5})\b/.exec(p.adresse ?? "")?.[1] ?? null;
  const ville = cp ? (p.adresse ?? "").split(cp)[1]?.replace(/[,\s]+/g, " ").trim() || null : null;
  let web: Trouve | null = null;
  try { web = await rechercheWeb(p); } catch (e) { console.warn("[enrichir] recherche web :", (e as Error).message); }
  const t: Trouve = {
    entreprise: p.societe, secteur: web?.secteur ?? p.cibleId ? (await prisma.cible.findUnique({ where: { id: p.cibleId! } }))?.nom.toLowerCase() ?? null : null,
    code_postal: cp ?? web?.code_postal ?? null, ville: ville ?? web?.ville ?? null, adresse: p.adresse ?? web?.adresse ?? null,
    telephone: p.telephone ?? p.contacts[0]?.telephone ?? web?.telephone ?? null, email: p.contacts[0]?.email ?? web?.email ?? null,
    site_web: p.siteWeb ?? web?.site_web ?? null, note_google: web?.note_google ?? null, avis_google: web?.avis_google ?? null,
    facebook: web?.facebook ?? null, instagram: web?.instagram ?? null, fiche_google: web?.fiche_google ?? null, google_ads: web?.google_ads ?? null,
    presence: web?.presence ?? null, source: web?.source ?? "Fiche saisie à la main, complétée par le registre officiel et l’audit du site",
  };
  const [reg, audit] = await Promise.all([lookupRegistre(p.societe, t.code_postal ?? null, t.ville ?? null).catch(() => null), auditSite(t.site_web ?? null, t.ville ?? null)]);
  const infos = row(t, reg, audit);
  if (p.siren && !infos.SIREN) infos.SIREN = p.siren;
  if (p.dirigeant && !infos.Dirigeant) infos.Dirigeant = p.dirigeant;
  await prisma.prospect.update({
    where: { id },
    data: {
      infos: infos as Prisma.InputJsonObject, infosAt: new Date(),
      siren: p.siren ?? reg?.siren ?? undefined, siret: p.siret ?? reg?.siret ?? undefined, dirigeant: p.dirigeant ?? reg?.dirigeant ?? undefined,
      siteWeb: p.siteWeb ?? (web?.site_web ? (/^https?:\/\//.test(web.site_web) ? web.site_web : `https://${web.site_web}`) : undefined),
      adresse: p.adresse ?? web?.adresse ?? undefined, telephone: p.telephone ?? web?.telephone ?? undefined,
    },
  });
  if (!p.contacts[0]?.email && web?.email && p.contacts[0]) await prisma.prospectContact.update({ where: { id: p.contacts[0].id }, data: { email: web.email.toLowerCase() } });
  return { ok: true, infos, web: !!web };
}
