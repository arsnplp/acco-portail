/**
 * Import des vrais clients (feuille « TODO ACCO - Clients » en CSV) dans le portail et l'espace Commercial :
 * client (suivi par, fiche Google, engagement), site (en ligne ou en création avec lien provisoire), abonnement mensuel
 * (ou paiement unique), fiche prospect « Gagné » reliée, contact principal (emails relevés dans Stripe le 6 nov. 2026).
 * AUCUN compte de connexion, mail, push ni invitation : le script écrit seulement en base. Relançable sans doublon (legacyId).
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/import-clients.mts --csv ~/Downloads/clients.csv              # aperçu
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/import-clients.mts --csv ~/Downloads/clients.csv --confirmer  # pour de bon
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { prisma } from "../src/lib/prisma";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const csvPath = arg("--csv")?.replace(/^~(?=$|\/)/, homedir());
const confirm = process.argv.includes("--confirmer");
if (!csvPath) { console.log("Usage : … --csv fichier.csv [--confirmer]"); process.exit(1); }

/** Référents de l'ancien outil → emails de l'équipe (confirmé par Arsène le 6 nov. 2026). */
const REFERENT: Record<string, string> = { "99dcb529": "bilel@acco-lab.fr", e4361155: "lucas@acco-lab.fr" };

/** Compléments donnés par Arsène le 6 nov. 2026 (sites, contacts Stripe, cas particuliers). Clé : ID_Client. */
type Extra = { site?: string; preview?: string; sansTelephone?: boolean; contact?: { prenom?: string; nom?: string; email: string }; paiementUnique?: number; ignorer?: boolean; finEngagementInconnue?: boolean };
const EXTRA: Record<string, Extra> = {
  "577a920b": { site: "https://holeen-family.com/", contact: { nom: "Holeen Family", email: "holeenfamily13@gmail.com" } },
  a1a64280: { contact: { prenom: "Véronique", nom: "Deprez", email: "veronique@loratma.fr" } },
  be6dfe0d: { preview: "https://fruitierv2.nairox.fr/" },
  "08154fb5": { contact: { prenom: "Pascal", nom: "Viou", email: "fpnature13@gmail.com" } },
  de2b4314: { contact: { prenom: "Priscillia", nom: "Pivon", email: "swella.pilates@gmail.com" } },
  "58118a2a": { contact: { prenom: "Michaël", nom: "Coulaux", email: "midpjardin@gmail.com" } },
  "4b416097": { contact: { nom: "Institut Maison Chantal", email: "maisonchantal13@gmail.com" } },
  "678f0fa2": { paiementUnique: 1200 }, // Grain de Douceur : payé en une fois par virement, pas d'abonnement
  "5a739275": { preview: "https://dentiste1.nairox.fr/" },
  "46dce337": { ignorer: true }, // Acco Lab : c'est nous, géré à part (client « Acco » du portail = compte test)
  "84153901": { site: "https://acsms.fr/", sansTelephone: true }, // même numéro que Glamour Nails : on n'en met aucun
  "962bd994": { site: "https://glamour-nails.fr/", sansTelephone: true, contact: { prenom: "Thi Cam Trang", nom: "Nguyen", email: "glamournails.aix35@gmail.com" } },
  "927cb381": { site: "https://poke-dore.fr/", finEngagementInconnue: true, contact: { nom: "Bouisset", email: "lepokedaure@gmail.com" } }, // fin d'engagement = jour du début dans la feuille : à corriger
  "7f0a3995": { contact: { nom: "Chacha Pilates Studio", email: "chachapilates@gmail.com" } },
};

// ─── CSV ─────────────────────────────────────────────────────
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some((c) => c.trim()));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}
const str = (v?: string) => { const s = (v ?? "").trim(); return !s || /^(none|null|-|n\/a)$/i.test(s) ? null : s; };
const num = (v?: string) => { const s = str(v); if (!s) return null; const n = Number(s.replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const date = (v?: string) => { const s = str(v); const m = s?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : null; };
const phone = (v?: string) => { const s = str(v); if (!s) return null; const d = s.replace(/[^\d+]/g, ""); return d.replace(/^\+33/, "0").replace(/(\d{2})(?=\d)/g, "$1 ").trim(); };
const url = (v?: string) => { const s = str(v); if (!s || !/[.]/.test(s)) return null; return /^https?:\/\//i.test(s) ? s : `https://${s}`; };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Noms propres tels qu'Acco les écrit (sinon : première lettre de chaque mot en majuscule). */
const NOMS: Record<string, string> = { "08154fb5": "FP Nature Nuisible", "58118a2a": "Mas if de Provence", "84153901": "ACS Multiservices", "927cb381": "Poké d'Oré", "678f0fa2": "Grain de Douceur", a1a64280: "L'Or Atma", "263d6c9b": "By Carly Beauty" };
const titre = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());

async function main() {
  const rows = parseCsv(readFileSync(csvPath!, "utf8"));
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const clientsExistants = await prisma.client.findMany({ select: { id: true, name: true } });
  const manques: string[] = [];
  const bilan = new Map<string, number>(); const add = (k: string) => bilan.set(k, (bilan.get(k) ?? 0) + 1);

  await prisma.$transaction(async (tx) => {
    // Références ACCO-<année>-<n> numérotées dans la transaction (nouvelleReference() ne verrait pas les contrats créés ici).
    const compteurs = new Map<number, number>();
    const reference = async (d: Date) => {
      const annee = d.getUTCFullYear();
      if (!compteurs.has(annee)) {
        const derniers = await tx.contrat.findMany({ where: { reference: { startsWith: `ACCO-${annee}-` } }, select: { reference: true } });
        compteurs.set(annee, derniers.reduce((m, c) => Math.max(m, parseInt(c.reference.slice(`ACCO-${annee}-`.length), 10) || 0), 0));
      }
      const n = compteurs.get(annee)! + 1; compteurs.set(annee, n);
      return `ACCO-${annee}-${String(n).padStart(4, "0")}`;
    };
    for (const r of rows) {
      const legacyId = str(r.ID_Client), brut = str(r.Nom_Societe);
      if (!legacyId || !brut) continue;
      const x = EXTRA[legacyId] ?? {};
      if (x.ignorer) { add("ignorés (Acco)"); continue; }
      const name = NOMS[legacyId] ?? titre(brut.replace(/’/g, "'"));
      const commercialId = REFERENT[str(r.ID_Referent) ?? ""] ? byEmail.get(REFERENT[str(r.ID_Referent)!]) ?? null : null;
      const tel = x.sansTelephone ? null : phone(r.Telephone);
      const siteUrl = x.site ?? url(r.Site_Web);
      const gmb = url(r["Fiche Google"]);
      const debut = date(r.Date_Debut_Contrat), fin = x.finEngagementInconnue ? null : date(r.Engage_jusqu_au);
      const tarif = num(r.Tarif_Mensuel);
      const q: string[] = [];
      if (!commercialId) q.push("commercial");
      if (!tel && !x.sansTelephone) q.push("téléphone");
      if (!siteUrl && !x.preview) q.push("site");
      if (!gmb) q.push("fiche Google");
      if (!fin) q.push("fin d’engagement");
      if (!x.contact) q.push("contact (nom, email)");
      q.push("SIREN", "adresse", "formule");

      // Client du portail
      const existing = clientsExistants.find((c) => norm(c.name) === norm(name));
      const clientId = existing?.id ?? (await tx.client.create({ data: { name, phone: tel, gmbUrl: gmb, commercialId, engagementDebut: debut, engagementFin: fin } })).id;
      if (existing) { await tx.client.update({ where: { id: clientId }, data: { phone: tel ?? undefined, gmbUrl: gmb ?? undefined, commercialId: commercialId ?? undefined, engagementDebut: debut ?? undefined, engagementFin: fin ?? undefined } }); add("clients déjà présents (complétés)"); }
      else add("clients créés");
      await tx.conversation.upsert({ where: { clientId }, create: { clientId }, update: {} });

      // Site : en ligne si une URL définitive existe, sinon en création (lien provisoire en préprod)
      const host = (siteUrl ?? x.preview) ? new URL(siteUrl ?? x.preview!).hostname.replace(/^www\./, "") : null;
      const sites = await tx.site.findMany({ where: { clientId }, select: { id: true } });
      if (sites.length === 0) {
        await tx.site.create({ data: { clientId, name: host ?? name, url: siteUrl, previewUrl: x.preview ?? null, status: siteUrl ? "EN_LIGNE" : "EN_CREATION", projectStep: siteUrl ? "A_LIVRER" : "VALIDER_MAQUETTE", launchedAt: siteUrl ? debut : null } });
        add("sites créés");
      }

      // Contrat signé (c'est lui qui alimente l'échéance, le mensuel et le MRR), avec le jour de prélèvement de la feuille
      const jour = num(r.Jour_Facturation);
      const siteId = (await tx.site.findFirst({ where: { clientId }, select: { id: true } }))?.id ?? null;
      let contrat = await tx.contrat.findFirst({ where: { clientId } });
      if (!contrat) {
        const mois = debut && fin ? Math.max(1, Math.round((fin.getTime() - debut.getTime()) / (30.44 * 86400_000))) : 12;
        contrat = await tx.contrat.create({ data: {
          reference: await reference(debut ?? new Date()), clientId, siteId, commercialId, statut: "SIGNE", titre: x.paiementUnique ? "Création du site" : "Abonnement site",
          montantMensuelHt: x.paiementUnique ? 0 : Math.round((tarif ?? 0) * 100), montantPonctuelHt: x.paiementUnique ? Math.round(x.paiementUnique * 100) : 0,
          moyenPaiement: x.paiementUnique ? "VIREMENT" : null, dureeMois: mois, reconductionMois: 12, jourPrelevement: jour && jour >= 1 && jour <= 31 ? Math.round(jour) : null,
          debutEngagement: debut, finEngagement: fin, signeAt: debut, premierPaiementAt: debut, sourceFinanciere: "import",
        } });
        add("contrats signés");
      } else if (jour && !contrat.jourPrelevement) await tx.contrat.update({ where: { id: contrat.id }, data: { jourPrelevement: Math.round(jour) } });
      if (!jour) q.push("jour de prélèvement");

      // Ligne d'abonnement rattachée au contrat (pas comptée deux fois dans le MRR)
      const sub = await tx.subscription.findFirst({ where: { clientId } });
      if (!sub) {
        if (x.paiementUnique) { await tx.subscription.create({ data: { clientId, siteId, contratId: contrat.id, label: "Création du site (payé en une fois par virement)", billing: "PONCTUEL", priceCents: Math.round(x.paiementUnique * 100), startedAt: debut ?? new Date(), commitmentEndsAt: fin } }); add("paiements uniques"); }
        else if (tarif) { await tx.subscription.create({ data: { clientId, siteId, contratId: contrat.id, label: "Abonnement site", billing: "MENSUEL", priceCents: Math.round(tarif * 100), startedAt: debut ?? new Date(), commitmentEndsAt: fin } }); add("abonnements mensuels"); }
      } else if (!sub.contratId) await tx.subscription.update({ where: { id: sub.id }, data: { contratId: contrat.id } });

      // Fiche commerciale « Gagné »
      let prospect = await tx.prospect.findFirst({ where: { OR: [{ legacyId }, { clientId }] } });
      if (!prospect) {
        prospect = await tx.prospect.create({ data: { legacyId, societe: name, telephone: tel, siteWeb: siteUrl, statut: "GAGNE", gagneAt: debut, clientId, commercialId, mensuelEuros: tarif ? Math.round(tarif) : x.paiementUnique ? 0 : null, fraisCreationEuros: x.paiementUnique ?? null } });
        add("fiches CRM créées");
      }
      if (x.contact) {
        const dejaLa = await tx.prospectContact.findFirst({ where: { prospectId: prospect.id, email: x.contact.email } });
        if (!dejaLa) { await tx.prospectContact.create({ data: { prospectId: prospect.id, prenom: x.contact.prenom ?? null, nom: x.contact.nom ?? null, email: x.contact.email, principal: true } }); add("contacts"); }
      }
      manques.push(`${name} : ${q.join(", ")}`);
    }
    if (!confirm) throw new Error("APERCU");
  }, { timeout: 120_000, maxWait: 10_000 }).catch((e) => { if ((e as Error).message !== "APERCU") throw e; });

  console.log(confirm ? "IMPORT EFFECTUÉ" : "APERÇU (rien n'est écrit)");
  for (const [k, v] of bilan) console.log(`  ${k} : ${v}`);
  console.log("\nInfos manquantes par client :");
  for (const m of manques) console.log("  - " + m);
}
main().finally(() => prisma.$disconnect());
