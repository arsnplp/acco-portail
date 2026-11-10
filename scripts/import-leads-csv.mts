/**
 * Import de fichiers CSV de leads (36 colonnes, format « leads_<secteur>.csv ») dans le coffre à leads.
 * Une liste par fichier. Les colonnes sont remises au format de l'appli (score sur 100, fiabilité sur 100, état A/C,
 * faiblesses séparées par « | », ville « CP Ville », dirigeant « NOM Prénom »), les données fausses sont vidées.
 *
 * AUCUN prospect n'est créé : les listes arrivent dans le coffre, prêtes à être envoyées dans « À contacter ».
 *
 *   npx tsx --env-file=.env scripts/import-leads-csv.mts ~/Downloads/leads_acco_csv/*.csv              # aperçu, rien n'est gardé
 *   npx tsx --env-file=.env scripts/import-leads-csv.mts ~/Downloads/leads_acco_csv/*.csv --confirmer  # import pour de bon
 *
 * Relançable sans doublon : un fichier déjà importé (même nom) est sauté, un lead déjà connu (CRM, portail, coffre) est écarté.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirmer");
const region = (() => { const i = process.argv.indexOf("--region"); return i > 0 ? process.argv[i + 1] : "Aix-en-Provence et alentours"; })();
const files = process.argv.slice(2).filter((a, i, all) => a.endsWith(".csv") && all[i - 1] !== "--region");
if (!files.length) { console.log("Usage : npx tsx --env-file=.env scripts/import-leads-csv.mts fichier.csv [...] [--region \"…\"] [--confirmer]"); process.exit(1); }

// ─── CSV ─────────────────────────────────────────────────────
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, "").trim(), (r[i] ?? "").trim()])) as Record<string, string>);
}

// ─── Nettoyage ───────────────────────────────────────────────
const s = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const n = (v: string | undefined) => { const x = Number(String(v ?? "").replace(",", ".")); return v && v.trim() !== "" && Number.isFinite(x) ? x : null; };
const digits = (v: string | null) => (v ?? "").replace(/[^\d+]/g, "").replace(/^\+33/, "0");
const host = (u: string | null) => { if (!u) return null; try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };
const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(sarl|sas|sasu|eurl|ei|sci|sa|snc|institut|salon|la|le|les|l|de|du|des|et)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/** SIREN trouvés sur le site mais qui sont ceux de l'hébergeur ou d'une collectivité : identité fausse, on la vide. */
const SIREN_FAUX = new Set(["424761419" /* OVH */, "423093459" /* Gandi */, "211300983" /* commune de Venelles */]);
const COLS_REGISTRE = ["Dirigeant", "Rôle", "SIREN", "SIRET", "TVA intracom", "Forme juridique", "Code NAF", "Date de création", "État", "Établissements (total)", "Établissements ouverts", "Fiabilité identité"];
/** E-mails d'exemple ou d'un tiers (agence, designer, autre société) relevés sur le site. */
const EMAIL_FAUX = /exemple|example|@mail\.com$|@email\.fr$|@domaine\.com$|@futurdigital\.fr$|@clotildemilesi-design\.com$|@cmap\.fr$|@esin\.com$/i;
const FORMES: Record<string, string> = { "5202": "SNC", "5699": "SA à directoire", "6589": "Société civile de moyens", "6597": "SCEA", "6598": "EARL", "7210": "Commune", "7220": "Département" };
const FIABILITE: [RegExp, number][] = [[/^très haute/i, 95], [/^haute/i, 80], [/^moyenne/i, 65], [/^faible/i, 45]];

function email(v: string | undefined) {
  let e = s(v)?.replace(/^%20/, "").trim() ?? null;
  if (!e) return null;
  if (/^ontact@/.test(e)) e = "c" + e;
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) && !EMAIL_FAUX.test(e) ? e : null;
}
function reseau(v: string | undefined, domaine: "facebook" | "instagram") {
  let u = s(v);
  if (!u) return null;
  u = u.replace(/^https?:\/\/urldefense\.com\/v3\/__/, "").replace(/^https?:\/\/(www\.)?instagram\.com\/(?=https?:)/, "");
  const h = host(u);
  if (!h || !h.endsWith(`${domaine}.com`)) return null;
  const path = new URL(u).pathname.replace(/\/$/, "");
  if (!path || path === "/profile.php" || /\/videos\//.test(path)) return null; // lien générique ou page d'un autre (vidéo BFM)
  return u;
}
/** « Lamia Djouhri (Mahfoudia) » → « DJOUHRI (MAHFOUDIA) Lamia », comme le registre (et lu ainsi à l'envoi dans le CRM). */
function dirigeant(v: string | undefined) {
  const d = s(v);
  if (!d || /non-diffusible/i.test(d)) return null;
  if (d === d.toUpperCase()) return d; // personne morale
  const usage = d.match(/\(([^)]*)\)\s*$/)?.[1]?.trim();
  const mots = d.replace(/\([^)]*\)\s*$/, "").trim().split(/\s+/);
  if (mots.length < 2) return d;
  return [mots.slice(1).join(" ").toUpperCase(), usage ? `(${usage.toUpperCase()})` : null, mots[0]].filter(Boolean).join(" ");
}

function convertir(r: Record<string, string>) {
  const adresse = s(r.Adresse);
  const cp = adresse?.match(/\b(\d{5})\b(?!.*\b\d{5}\b)/)?.[1] ?? null;
  const ville = s(r.Ville);
  const siren = s(r.SIREN);
  const fiab = s(r["Fiabilité identité"]);
  const forme = s(r["Forme juridique"]);
  const faiblesses = s(r["Faiblesses SEO"])?.split(/\s*;\s*/).filter(Boolean) ?? [];
  const facebook = reseau(r.Facebook, "facebook"), instagram = reseau(r.Instagram, "instagram");
  if (!facebook && !instagram) faiblesses.push("Aucune présence réseaux");
  const d: Record<string, string | number | null> = {
    Entreprise: r.Entreprise.trim(), Secteur: s(r.Secteur)?.toLowerCase() ?? null, Ville: [cp, ville].filter(Boolean).join(" ") || null, Adresse: adresse,
    "Téléphone": s(r["Téléphone"]), Email: email(r.Email), "Site web": s(r["Site web"]), Dirigeant: dirigeant(r.Dirigeant), "Rôle": s(r["Rôle"]),
    "Note Google": n(r["Note Google"]), "Avis Google": n(r["Avis Google"]), "Fiche Google": s(r["Fiche Google"]),
    Score: n(r.Score) !== null ? Math.round(n(r.Score)! * 10) : null, // fichier sur 10, appli sur 100
    SIREN: siren, SIRET: s(r.SIRET), "TVA intracom": s(r["TVA intracom"]), "Forme juridique": forme ? FORMES[forme] ?? forme : null,
    "Code NAF": s(r["Code NAF"]), "Date de création": s(r["Date de création"]),
    "État": r["État"] === "Active" ? "A" : r["État"] === "Fermée" ? "C" : s(r["État"]),
    "Établissements (total)": n(r["Établissements (total)"]), "Établissements ouverts": n(r["Établissements ouverts"]),
    "Fiabilité identité": fiab ? FIABILITE.find(([re]) => re.test(fiab))?.[1] ?? null : null,
    CMS: s(r.CMS), "Hébergeur": s(r["Hébergeur"]), "Âge domaine": s(r["Âge domaine"]), "Vitesse mobile": n(r["Vitesse mobile"]), "Vitesse desktop": n(r["Vitesse desktop"]),
    HTTPS: s(r.HTTPS), Responsive: s(r.Responsive),
    "Google Ads": /^oui/i.test(r["Google Ads"] ?? "") ? "Oui" : null, // « Non détecté » ≠ « Non » : laissé vide
    "Score SEO": n(r["Score SEO"]), "Faiblesses SEO": faiblesses.join(" | ") || null, Facebook: facebook, Instagram: instagram,
    "Autre téléphone": s(r["Autre téléphone"]),
    _source: "Import CSV", _presence: !s(r["Site web"]) ? "sans site" : null,
  };
  if (siren && SIREN_FAUX.has(siren)) for (const c of COLS_REGISTRE) d[c] = null;
  return d;
}

// ─── Import ──────────────────────────────────────────────────
const [prospects, contacts, clients, leads, deja, admin] = await Promise.all([
  prisma.prospect.findMany({ select: { societe: true, telephone: true, siteWeb: true } }),
  prisma.prospectContact.findMany({ where: { telephone: { not: null } }, select: { telephone: true } }),
  prisma.client.findMany({ select: { name: true, phone: true } }),
  prisma.lead.findMany({ select: { entreprise: true, telephone: true, siteWeb: true } }),
  prisma.leadListe.findMany({ where: { message: { startsWith: "Import CSV" } }, select: { message: true } }),
  prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true } }),
]);
const phones = new Set([...prospects.map((p) => p.telephone), ...contacts.map((c) => c.telephone), ...clients.map((c) => c.phone), ...leads.map((l) => l.telephone)].map(digits).filter((p) => p.length >= 9));
const hosts = new Set([...prospects.map((p) => host(p.siteWeb)), ...leads.map((l) => host(l.siteWeb))].filter(Boolean) as string[]);
const noms = new Set([...prospects.map((p) => p.societe), ...clients.map((c) => c.name), ...leads.map((l) => l.entreprise)].map(norm).filter(Boolean));
console.log(`Base : ${prospects.length} prospects, ${clients.length} clients, ${leads.length} leads dans le coffre. Auteur des listes : ${admin?.email ?? "aucun"}.\n${confirm ? "IMPORT RÉEL" : "APERÇU (rien n'est écrit, ajoutez --confirmer)"}\n`);

for (const file of files) {
  const nom = basename(file);
  if (deja.some((l) => l.message?.includes(`(${nom})`))) { console.log(`${nom} : déjà importé, sauté.`); continue; }
  const rows = parseCsv(readFileSync(file, "utf8")).filter((r) => r.Entreprise);
  const secteur = rows[0]?.Secteur ?? nom.replace(/^leads_|\.csv$/g, "");
  const garde: Record<string, string | number | null>[] = [], ecartes: string[] = [];
  for (const r of rows) {
    const d = convertir(r);
    const tel = digits(d["Téléphone"] as string | null), h = host(d["Site web"] as string | null), k = norm(d.Entreprise as string);
    const cleAdresse = `${k}|${norm((d.Adresse as string) ?? "")}`;
    if ((tel.length >= 9 && phones.has(tel)) || (h && hosts.has(h) && !/booking|fresha|setmore|nailsy|tickandbox|wixsite|solocal/.test(h)) || noms.has(cleAdresse) || (k && noms.has(k) && tel.length < 9)) { ecartes.push(d.Entreprise as string); continue; }
    garde.push(d);
    if (tel.length >= 9) phones.add(tel);
    if (h) hosts.add(h);
    noms.add(cleAdresse);
  }
  garde.sort((a, b) => Number(b.Score ?? 0) - Number(a.Score ?? 0));
  const sansTel = garde.filter((d) => !d["Téléphone"]).length;
  const message = `Import CSV (${nom}) : ${garde.length} leads${ecartes.length ? `, ${ecartes.length} déjà connu${ecartes.length > 1 ? "s" : ""} écarté${ecartes.length > 1 ? "s" : ""}` : ""}${sansTel ? `, dont ${sansTel} sans téléphone (non envoyables dans le CRM)` : ""}.`;
  console.log(`${nom} → « ${secteur} » : ${rows.length} lignes, ${garde.length} gardés, ${ecartes.length} écartés${sansTel ? `, ${sansTel} sans téléphone` : ""}${ecartes.length ? `\n   écartés : ${ecartes.join(" ; ")}` : ""}`);
  if (!confirm || !garde.length) continue;
  await prisma.leadListe.create({
    data: {
      secteur, region, demande: garde.length, obtenus: garde.length, ecartes: ecartes.length, statut: "PRETE", message, auteurId: admin?.id ?? null,
      leads: { create: garde.map((d) => ({ entreprise: d.Entreprise as string, telephone: (d["Téléphone"] as string) ?? null, siteWeb: (d["Site web"] as string) ?? null, siren: (d.SIREN as string) ?? null, ville: (d.Ville as string) ?? null, score: (d.Score as number) ?? null, donnees: d as Prisma.InputJsonValue })) },
    },
  });
}
await prisma.$disconnect();
