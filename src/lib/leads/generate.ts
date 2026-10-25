/**
 * Génération d'une liste de leads :
 * 1. Claude cherche sur le web des entreprises réelles du secteur et de la zone (en excluant celles qu'on a déjà).
 * 2. Le registre officiel complète l'identité (SIREN, dirigeant…), un audit rapide note le site.
 * 3. On écarte tout ce qui existe déjà (CRM, portail, coffre), on calcule le score et on range la liste dans le coffre.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/settings";
import { lookupRegistre, type Registre } from "./registre";
import { auditSite, type Audit } from "./audit";
import { fmtPhone, hostOf, norm, normPhone, similarity } from "./texte";
import type { LeadRow } from "./colonnes";

type Trouve = {
  entreprise: string; secteur?: string | null; code_postal?: string | null; ville?: string | null; adresse?: string | null; telephone?: string | null;
  email?: string | null; site_web?: string | null; note_google?: number | string | null; avis_google?: number | string | null; facebook?: string | null;
  instagram?: string | null; google_ads?: boolean | string | null; presence?: string | null; source?: string | null;
};
type Reponse = { leads: Trouve[]; estimation_total_zone?: number | null; commentaire?: string | null };

const MODEL = process.env.LEADS_MODEL ?? "claude-sonnet-5-5";

/** Consigne de recherche : précise, vérifiable, orientée « entreprises qui ont besoin d'un site ». */
export const SYSTEM_PROMPT = `Tu es chargé de recherche B2B pour une agence web française. Tu constitues des listes de prospects (entreprises locales) à appeler.

MISSION
Trouver des entreprises RÉELLES et ACTIVES qui correspondent exactement au secteur et à la zone demandés, à partir de ce que tu trouves en ligne : fiches Google (Maps), Pages Jaunes, Planity, Treatwell, Doctolib, annuaires professionnels, sites officiels, Facebook, Instagram.

RÈGLES STRICTES
1. Zéro invention. Chaque entreprise, adresse, téléphone, note et nombre d'avis doit venir d'une source que tu as réellement consultée. Information introuvable = null. Mieux vaut moins de leads que des leads faux.
2. Un lead = un établissement physique dans la zone demandée (adresse et code postal dans la zone). Pas d'enseignes nationales ni de franchises. Pas de doublon : même téléphone ou même adresse = même entreprise.
3. Priorité aux entreprises qui ont le plus besoin d'un site :
   a. d'abord celles SANS site web (seulement une fiche Google, une page Planity/Treatwell ou des réseaux sociaux) ;
   b. ensuite celles dont le site est FAIBLE (ancien, sans HTTPS, pas adapté au mobile, page de réservation générée, en construction) ;
   c. écarte celles qui ont déjà un site professionnel et moderne.
4. Parmi elles, privilégie les commerces qui tournent : beaucoup d'avis Google et une bonne note.
5. N'inclus AUCUNE entreprise de la liste « déjà connues » fournie, même écrite différemment.
6. Téléphone au format « 06 12 34 56 78 ». "site_web" = le site propre de l'entreprise uniquement (une page Planity, Treatwell, Facebook ou Instagram n'est pas un site : mets-la dans "source" ou dans "facebook"/"instagram").

MÉTHODE
- Varie les recherches : le métier et ses synonymes × chaque ville, arrondissement ou quartier de la zone, + « Pages Jaunes », « Planity », « avis ».
- Vérifie chaque fiche avant de la garder (adresse dans la zone, activité réelle, téléphone).
- Si la zone s'épuise, ne l'élargis pas : rends ce que tu as et dis-le dans "commentaire".

RÉPONSE
Termine par un unique bloc \`\`\`json contenant exactement :
{
  "leads": [
    {
      "entreprise": "nom commercial",
      "secteur": "métier en minuscules",
      "code_postal": "13100",
      "ville": "Aix-en-Provence",
      "adresse": "numéro, rue, code postal ville",
      "telephone": "06 12 34 56 78",
      "email": null,
      "site_web": "https://… ou null",
      "note_google": 4.8,
      "avis_google": 120,
      "facebook": "URL ou null",
      "instagram": "URL ou null",
      "google_ads": null,
      "presence": "sans site | site faible | site correct",
      "source": "pages consultées (Planity, Pages Jaunes, fiche Google…) et remarque utile"
    }
  ],
  "estimation_total_zone": 120,
  "commentaire": "une phrase : zone épuisée ? beaucoup d'autres entreprises restent ?"
}
"estimation_total_zone" = ton estimation du nombre TOTAL d'entreprises de ce secteur dans la zone (toutes, pas seulement celles de ta liste).`;

function userPrompt(n: number, secteur: string, region: string, connues: string[]) {
  return `Trouve ${n} entreprises.
Secteur d'activité : ${secteur}
Zone : ${region}

Déjà connues (à exclure) : ${connues.length ? connues.join(" ; ") : "aucune"}`;
}

async function anthropicKey() {
  return (await getSecret("anthropic_api_key")) ?? (await getSecret("claude_code_api_key"));
}

function parseJson(text: string): Reponse {
  const block = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(block) as Reponse;
  if (!Array.isArray(data.leads)) throw new Error("Réponse sans liste de leads");
  return data;
}

/** Appel à Claude avec la recherche web (boucle tant que Claude met son tour en pause). */
async function rechercher(n: number, secteur: string, region: string, connues: string[]) {
  if (process.env.LEADS_MOCK) return { data: parseJson(readFileSync(process.env.LEADS_MOCK, "utf8")), recherches: 0, cout: 0 };
  const key = await anthropicKey();
  if (!key) throw new Error("Aucune clé Anthropic : ajoutez-la dans Admin → Paramètres.");
  const client = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt(n, secteur, region, connues) }];
  const tools = [{ type: "web_search_20260318", name: "web_search", max_uses: Math.min(60, 10 + n), user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" } }] as unknown as Anthropic.ToolUnion[];
  let recherches = 0, inTok = 0, outTok = 0, text = "";
  for (let tour = 0; tour < 10; tour++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: 32_000, system: SYSTEM_PROMPT, tools, messages });
    recherches += (res.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
    inTok += res.usage.input_tokens; outTok += res.usage.output_tokens;
    text = res.content.filter((c) => c.type === "text").map((c) => (c as Anthropic.TextBlock).text).join("\n");
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  // Coût indicatif : recherches (10 $ / 1000) + jetons (tarif Sonnet, 3 $ et 15 $ par million).
  const cout = recherches * 0.01 + inTok * 3e-6 + outTok * 15e-6;
  return { data: parseJson(text), recherches, cout };
}

/** Exécute n tâches avec au plus `max` en parallèle. */
async function parallel<T, R>(items: T[], max: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(max, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, "")); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null; };

/** Score du lead (0 à 100) : besoin d'un site + réputation + entreprise bien active. */
function scoreLead(t: Trouve, audit: Audit, reg: Registre | null) {
  let s = 0;
  if (!audit.joignable && !t.site_web) s += 40; // pas de site : le plus gros besoin
  else if (!audit.joignable) s += 35; // site injoignable
  else s += audit.scoreSeo <= 1 ? 32 : audit.scoreSeo <= 3 ? 22 : 8;
  const avis = num(t.avis_google) ?? 0, note = num(t.note_google) ?? 0;
  s += Math.min(avis, 200) / 200 * 25;
  s += note >= 4.7 ? 12 : note >= 4.3 ? 8 : note >= 4 ? 4 : 0;
  if (reg?.etat === "A") s += 10;
  if (reg && reg.fiabilite >= 80) s += 8;
  if (t.facebook || t.instagram) s += 3;
  return Math.max(1, Math.min(100, Math.round(s)));
}

function row(t: Trouve, reg: Registre | null, audit: Audit): LeadRow {
  const ville = [t.code_postal, t.ville].filter(Boolean).join(" ") || null;
  const faiblesses = [...audit.faiblesses, ...(!t.facebook && !t.instagram ? ["Aucune présence réseaux"] : [])];
  return {
    Entreprise: t.entreprise.trim(), Secteur: t.secteur ?? null, Ville: ville, Adresse: t.adresse ?? null, "Téléphone": fmtPhone(t.telephone),
    Email: t.email ?? null, "Site web": t.site_web ?? null, Dirigeant: reg?.dirigeant ?? null, "Rôle": reg?.role ?? null,
    "Note Google": num(t.note_google), "Avis Google": num(t.avis_google), Score: scoreLead(t, audit, reg),
    SIREN: reg?.siren ?? null, SIRET: reg?.siret ?? null, "TVA intracom": reg?.tva ?? null, "Forme juridique": reg?.forme ?? null,
    "Code NAF": reg?.naf ?? null, "Date de création": reg?.creation ?? null, "État": reg?.etat ?? null,
    "Établissements (total)": reg?.etabTotal ?? null, "Établissements ouverts": reg?.etabOuverts ?? null, "Fiabilité identité": reg?.fiabilite ?? null,
    CMS: audit.cms, "Hébergeur": audit.hebergeur, "Âge domaine": audit.ageDomaine, "Vitesse mobile": audit.vitesseMobile, "Vitesse desktop": audit.vitesseDesktop,
    HTTPS: audit.https, Responsive: audit.responsive, "Google Ads": t.google_ads === true || t.google_ads === "Oui" ? "Oui" : t.google_ads === false || t.google_ads === "Non" ? "Non" : null,
    "Score SEO": audit.scoreSeo, "Faiblesses SEO": faiblesses.join(" | "), Facebook: t.facebook ?? null, Instagram: t.instagram ?? null,
    _source: t.source ?? null, _presence: t.presence ?? null,
  };
}

/** Tout ce qu'on connaît déjà : prospects, clients du portail et leads du coffre. */
async function connus() {
  const [prospects, contacts, clients, leads] = await Promise.all([
    prisma.prospect.findMany({ select: { societe: true, telephone: true, siren: true, siteWeb: true, adresse: true } }),
    prisma.prospectContact.findMany({ where: { telephone: { not: null } }, select: { telephone: true } }),
    prisma.client.findMany({ select: { name: true, phone: true, siren: true } }),
    prisma.lead.findMany({ select: { entreprise: true, telephone: true, siren: true, siteWeb: true, ville: true } }),
  ]);
  const phones = new Set([...prospects.map((p) => p.telephone), ...contacts.map((c) => c.telephone), ...clients.map((c) => c.phone), ...leads.map((l) => l.telephone)].map(normPhone).filter(Boolean) as string[]);
  const sirens = new Set([...prospects.map((p) => p.siren), ...clients.map((c) => c.siren), ...leads.map((l) => l.siren)].filter(Boolean).map((s) => s!.replace(/\s/g, "")));
  const hosts = new Set([...prospects.map((p) => hostOf(p.siteWeb)), ...leads.map((l) => hostOf(l.siteWeb))].filter(Boolean) as string[]);
  const noms = [...prospects.map((p) => ({ nom: p.societe, lieu: p.adresse ?? "" })), ...clients.map((c) => ({ nom: c.name, lieu: "" })), ...leads.map((l) => ({ nom: l.entreprise, lieu: l.ville ?? "" }))];
  const nomsNorm = new Set(noms.map((n) => norm(n.nom)).filter(Boolean));
  return { phones, sirens, hosts, noms, nomsNorm };
}

function regionTokens(region: string) {
  return norm(region).split(" ").filter((w) => w.length >= 3 || /^\d{2,5}$/.test(w));
}

export async function generateLeadList(listeId: string) {
  const liste = await prisma.leadListe.findUniqueOrThrow({ where: { id: listeId } });
  try {
    const known = await connus();
    // Noms à exclure transmis à Claude : ceux de la même zone (ou du même secteur), 400 au plus.
    const tokens = regionTokens(liste.region), secteur = norm(liste.secteur);
    const proches = known.noms.filter((n) => tokens.some((t) => norm(n.lieu).includes(t)) || (secteur && norm(n.nom).includes(secteur.split(" ")[0] ?? "")));
    const exclus = [...new Set(proches.map((n) => n.nom))].slice(0, 400);

    const demandeIA = Math.min(60, Math.ceil(liste.demande * 1.3) + 2); // un peu plus, pour compenser les doublons écartés
    const { data, recherches, cout } = await rechercher(demandeIA, liste.secteur, liste.region, exclus);

    // Doublons : déjà connus, ou en double dans la réponse elle-même.
    const vus = new Set<string>();
    let ecartes = 0;
    const candidats = data.leads.filter((t) => {
      if (!t?.entreprise) return false;
      const phone = normPhone(t.telephone), host = hostOf(t.site_web), nom = norm(t.entreprise);
      const dejaConnu = (phone && known.phones.has(phone)) || (host && known.hosts.has(host)) || (nom && known.nomsNorm.has(nom))
        || known.noms.some((k) => similarity(k.nom, t.entreprise) >= 0.9 && (!k.lieu || !t.code_postal || k.lieu.includes(t.code_postal)));
      const cle = phone ?? nom;
      if (dejaConnu || vus.has(cle)) { ecartes++; return false; }
      vus.add(cle);
      return true;
    });

    // Enrichissement (registre + site), puis dernier contrôle par SIREN.
    const enrichis = await parallel(candidats, 4, async (t) => {
      const [reg, audit] = await Promise.all([lookupRegistre(t.entreprise, t.code_postal ?? null, t.ville ?? null).catch(() => null), auditSite(t.site_web ?? null, t.ville ?? null)]);
      return { t, reg, audit };
    });
    const sirensVus = new Set<string>();
    const lignes = enrichis.filter(({ reg }) => {
      if (!reg?.siren) return true;
      if (known.sirens.has(reg.siren) || sirensVus.has(reg.siren)) { ecartes++; return false; }
      sirensVus.add(reg.siren);
      return true;
    }).map(({ t, reg, audit }) => row(t, reg, audit))
      .filter((r) => r["État"] !== "C") // entreprise fermée au registre
      .sort((a, b) => Number(b.Score ?? 0) - Number(a.Score ?? 0))
      .slice(0, liste.demande);

    const obtenus = lignes.length;
    const estimation = typeof data.estimation_total_zone === "number" ? data.estimation_total_zone : null;
    const dejaDansZone = proches.length;
    const reste = estimation !== null ? Math.max(0, estimation - dejaDansZone - obtenus) : null;
    const zone = `${liste.secteur} · ${liste.region}`;
    const message = obtenus === 0
      ? `Aucun nouveau lead pour ${zone} : tout ce qui a été trouvé est déjà dans le CRM, le portail ou le coffre. Essayez une autre zone ou un autre secteur.`
      : obtenus < liste.demande
        ? `Il ne reste que ${obtenus} nouveau${obtenus > 1 ? "x" : ""} lead${obtenus > 1 ? "s" : ""} pour ${zone} (demandé : ${liste.demande}${ecartes ? `, ${ecartes} déjà connu${ecartes > 1 ? "s" : ""} écarté${ecartes > 1 ? "s" : ""}` : ""}).${data.commentaire ? ` ${data.commentaire}` : ""}`
        : `${obtenus} leads générés pour ${zone}.${reste !== null ? ` Il en reste environ ${reste} dans cette zone : vous pouvez relancer une génération.` : data.commentaire ? ` ${data.commentaire}` : ""}`;

    await prisma.$transaction([
      prisma.lead.createMany({
        data: lignes.map((r) => ({
          listeId, entreprise: String(r.Entreprise), telephone: (r["Téléphone"] as string) ?? null, siteWeb: (r["Site web"] as string) ?? null,
          siren: (r.SIREN as string) ?? null, ville: (r.Ville as string) ?? null, score: (r.Score as number) ?? null, donnees: r as Prisma.InputJsonValue,
        })),
      }),
      prisma.leadListe.update({ where: { id: listeId }, data: { statut: "PRETE", obtenus, ecartes, estimationZone: estimation, message, recherches, coutUsd: Math.round(cout * 100) / 100 } }),
    ]);
  } catch (e) {
    console.error("[leads]", e);
    await prisma.leadListe.update({ where: { id: listeId }, data: { statut: "ERREUR", erreur: (e as Error).message.slice(0, 500), message: "La génération a échoué. Réessayez dans un instant." } });
  }
}
