/**
 * Import de l'ancien CRM (CRM_APP.xlsx) et de l'ancienne to-do (TODO_ACCO.xlsx) dans l'espace Commercial,
 * et recréation des vrais clients dans le portail (client, site, abonnement).
 *
 * AUCUN mail, push, invitation ni notification n'est envoyé : le script écrit seulement en base.
 * Les contacts des clients sont rangés dans leur fiche (espace Commercial), sans créer de compte de connexion.
 *
 *   npx tsx --env-file=.env scripts/import-crm.mts --crm ~/Downloads/CRM_APP.xlsx --todo ~/Downloads/TODO_ACCO.xlsx              # aperçu, rien n'est gardé
 *   npx tsx --env-file=.env scripts/import-crm.mts --crm ~/Downloads/CRM_APP.xlsx --todo ~/Downloads/TODO_ACCO.xlsx --confirmer  # import pour de bon
 *
 * Relançable sans doublon : chaque ligne garde son ID d'origine (legacyId) et n'est créée qu'une fois.
 */
import ExcelJS from "exceljs";
import { PrismaClient, type Prisma, type EchangeType, type ProspectStatut, type ProspectSource, type Priorite, type Recurrence, type ProjetStatut } from "@prisma/client";
import { homedir } from "node:os";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const expand = (p?: string) => p?.replace(/^~(?=$|\/)/, homedir());
const crmPath = expand(arg("--crm")), todoPath = expand(arg("--todo"));
const confirm = process.argv.includes("--confirmer");
if (!crmPath || !todoPath) {
  console.log("Usage : npx tsx --env-file=.env scripts/import-crm.mts --crm CRM_APP.xlsx --todo TODO_ACCO.xlsx [--confirmer]");
  process.exit(1);
}

// ─── Lecture Excel ───────────────────────────────────────────
type Row = Record<string, unknown>;
async function readBook(path: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const sheets: Record<string, Row[]> = {};
  wb.eachSheet((ws) => {
    const header: string[] = [];
    const rows: Row[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const values = (row.values as unknown[]).slice(1);
      if (n === 1) { values.forEach((v, i) => (header[i] = String(v ?? "").trim())); return; }
      const o: Row = {};
      header.forEach((h, i) => { if (h) o[h] = cell(values[i]); });
      if (Object.values(o).some((v) => v !== null && v !== undefined && v !== "")) rows.push(o);
    });
    sheets[ws.name] = rows;
  });
  return sheets;
}
function cell(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (v instanceof Date) return v;
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if ("result" in o) return o.result;
    if (o.text !== undefined) return o.text;
    if (o.hyperlink) return o.hyperlink;
  }
  return v;
}
const str = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/​/g, "").trim();
  return !s || /^(none|null|n\/a|-)$/i.test(s) ? null : s;
};
const num = (v: unknown) => { const s = str(v); if (s === null) return null; const n = Number(s.replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const date = (v: unknown) => {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const n = typeof v === "number" ? v : null;
  if (n !== null) return new Date(Math.round((n - 25569) * 864e5)); // date Excel
  const s = str(v); if (!s) return null;
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const d = fr ? new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1])) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const bool = (v: unknown) => v === true || /^(true|vrai|oui|1)$/i.test(String(v ?? "").trim());
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const phone = (v: unknown) => { const s = str(v); if (!s) return null; const d = s.replace(/[^\d+]/g, ""); return d.length === 9 && !d.startsWith("0") ? "0" + d : d; };
const url = (v: unknown) => { const s = str(v); if (!s || !/[.]/.test(s)) return null; return /^https?:\/\//i.test(s) ? s : `https://${s}`; };

// ─── Correspondances ─────────────────────────────────────────
const STATUT: Record<string, ProspectStatut> = { "a contacter": "A_CONTACTER", "a relancer": "A_RELANCER", "poser rdv": "POSER_RDV", "rdv pose": "RDV_POSE", "a signer": "A_SIGNER", gagne: "GAGNE", abandon: "PERDU", perdu: "PERDU" };
const SOURCE: Record<string, ProspectSource> = { "cold call": "COLD_CALL", prospection: "PROSPECTION_PHYSIQUE", "prospection physique": "PROSPECTION_PHYSIQUE", recommandation: "RECOMMANDATION", "site web": "SITE_WEB" };
const CIBLE: Record<string, string> = { "auto ecole": "Auto-école", "dieteticien nutritionniste": "Diététicien nutritionniste", "dieteticien-nutritionniste": "Diététicien nutritionniste", "coach sportif": "Coach sportif", "exterminateur nuisible": "Exterminateur nuisible", "conciergerie d'entreprise": "Conciergerie d'entreprise" };
const PRIORITE: Record<string, Priorite> = { basse: "BASSE", moyenne: "MOYENNE", haute: "HAUTE" };
const RECURRENCE: Record<string, Recurrence> = { ponctuel: "PONCTUEL", hebdomadaire: "HEBDOMADAIRE", "mensuel fixe": "MENSUEL_FIXE", "mensuel relatif": "MENSUEL_RELATIF" };
const JOURS: Record<string, number> = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 7 };
const POSITION: Record<string, number> = { "1er": 1, "2e": 2, "2eme": 2, "3e": 3, "3eme": 3, "4e": 4, "4eme": 4, dernier: 5 };
const PROJET_STATUT: Record<string, ProjetStatut> = { "a faire": "A_FAIRE", "en cours": "EN_COURS", "en pause": "EN_PAUSE", termine: "TERMINE", fait: "TERMINE" };
const INTERNAL_CLIENTS = new Set(["acco lab", "acco"]); // projets internes : pas de client portail

function cibleName(v: unknown) { const s = str(v); if (!s) return null; return CIBLE[norm(s)] ?? s.charAt(0).toUpperCase() + s.slice(1); }
function echangeType(notes: string | null): EchangeType {
  const n = norm(notes ?? "");
  if (/^nrp\b/.test(n) || n.startsWith("nrp")) return "NRP";
  if (/rdv pris|rendez-vous pris|prise de rdv/.test(n)) return "PRISE_RDV";
  if (/^rendez-vous|^rdv\b/.test(n)) return "RDV";
  if (/\bmail\b/.test(n)) return "MAIL";
  return "APPEL";
}

// ─── Import ──────────────────────────────────────────────────
const prisma = new PrismaClient();
const crm = await readBook(crmPath);
const todo = await readBook(todoPath);
const need = (b: Record<string, Row[]>, name: string) => b[name] ?? (console.log(`⚠ Onglet « ${name} » introuvable`), []);

const counts: Record<string, number> = {};
const add = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
const warnings: string[] = [];

class Preview extends Error {}

try {
  await prisma.$transaction(async (tx) => {
    // Équipe : ancien ID utilisateur / email → compte du portail
    const team = await tx.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, select: { id: true, email: true } });
    const byEmail = new Map(team.map((u) => [u.email.toLowerCase(), u.id]));
    const legacyUser = new Map<string, string>();
    for (const u of need(todo, "Utilisateurs")) { const id = str(u.ID_Utilisateur), email = str(u.Email)?.toLowerCase(); if (id && email) legacyUser.set(id, email); }
    const missing = new Set<string>();
    const userId = (v: unknown) => {
      const s = str(v); if (!s) return null;
      const email = s.includes("@") ? (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase() : legacyUser.get(s);
      if (!email) return null;
      const id = byEmail.get(email);
      if (!id && email.endsWith("@acco-lab.fr")) missing.add(email); // les auteurs externes (mails entrants) restent en texte
      return id ?? null;
    };

    // Cibles
    const cibles = new Map<string, string>();
    async function cibleId(v: unknown) {
      const name = cibleName(v); if (!name) return null;
      if (!cibles.has(name)) {
        const c = await tx.cible.upsert({ where: { nom: name }, create: { nom: name }, update: {} });
        cibles.set(name, c.id);
      }
      return cibles.get(name)!;
    }

    // 1. Prospects de l'ancien CRM
    const crmContacts = need(crm, "Contacts");
    for (const p of need(crm, "Prospects")) {
      const legacyId = str(p.ID_Prospect); const societe = str(p["Société"]);
      if (!legacyId || !societe) continue;
      const already = await tx.prospect.findUnique({ where: { legacyId } });
      if (already) {
        // Relance après création des comptes équipe : on complète le commercial manquant.
        const cid = already.commercialId ? null : userId(p["Assigné à"]);
        if (cid) await tx.prospect.update({ where: { id: already.id }, data: { commercialId: cid } });
        add("prospects déjà importés"); continue;
      }
      const statut = STATUT[norm(str(p.Statut) ?? "a contacter")] ?? "A_CONTACTER";
      const commercialId = userId(p["Assigné à"]);
      const prospect = await tx.prospect.create({
        data: {
          legacyId, societe, telephone: phone(p.Phone), siteWeb: url(p["Site Web"]), adresse: str(p.Adresse),
          cibleId: await cibleId(p.Cible), source: SOURCE[norm(str(p.Source) ?? "")] ?? null, statut,
          potentielEuros: num(p["Potentiel (EUR)"]) !== null ? Math.round(num(p["Potentiel (EUR)"])!) : null,
          commercialId, relanceAt: date(p["Prochaina Relanca"] ?? p["Prochaine Relance"]),
          perduAt: statut === "PERDU" ? new Date() : null,
        },
      });
      add("prospects");
      const rdv = date(p["Date de RDV"]);
      if (rdv) { await tx.rendezVous.create({ data: { prospectId: prospect.id, commercialId, debut: rdv, createdAt: rdv, resultat: rdv < new Date() ? "FAIT" : "PREVU" } }); add("rendez-vous"); }
      for (const c of crmContacts.filter((c) => str(c.ID_Prospect) === legacyId)) {
        await tx.prospectContact.create({ data: { prospectId: prospect.id, prenom: str(c.Prenom), nom: str(c.Nom), fonction: str(c.Fonction), email: str(c.Email)?.toLowerCase() ?? null, telephone: phone(c.Telephone), principal: bool(c.Est_Principal) } });
        add("contacts");
      }
    }

    // 2. Échanges de l'ancien CRM
    for (const e of need(crm, "Historique_Echanges")) {
      const legacyId = str(e.ID_Echange), notes = str(e.Notes);
      if (!legacyId || !notes || norm(notes) === "test") continue;
      if (await tx.echange.findUnique({ where: { legacyId } })) continue;
      const prospect = await tx.prospect.findUnique({ where: { legacyId: str(e.Prospect_ID) ?? "" }, select: { id: true } });
      if (!prospect) { add("échanges ignorés (prospect inconnu)"); continue; }
      await tx.echange.create({ data: { legacyId, prospectId: prospect.id, type: echangeType(notes), notes, date: date(e.Date_Echange) ?? new Date(), auteurId: userId(e.Commercial), auteurNom: userId(e.Commercial) ? null : str(e.Commercial), origine: "import" } });
      add("échanges");
    }

    // 3. Vrais clients → portail (client, site, abonnement) + fiche commerciale « Gagné »
    const clientByLegacy = new Map<string, { clientId: string; siteId: string | null }>();
    const todoContacts = need(todo, "Contacts");
    const seen = new Map<string, { clientId: string; siteId: string | null }>(); // doublons de nom dans le fichier
    for (const c of need(todo, "Clients")) {
      const legacyId = str(c.ID_Client), name = str(c.Nom_Societe);
      if (!legacyId || !name) continue;
      if (INTERNAL_CLIENTS.has(norm(name))) continue;
      const key = norm(name);
      if (seen.has(key)) { clientByLegacy.set(legacyId, seen.get(key)!); add("clients en double fusionnés"); continue; }

      const legacyProspectId = str(c.ID_Prospect) ?? legacyId;
      let prospect = await tx.prospect.findFirst({ where: { legacyId: { in: [legacyProspectId, legacyId] } } });
      let clientId = prospect?.clientId ?? null;
      if (!clientId) {
        const existing = (await tx.client.findMany({ select: { id: true, name: true } })).find((x) => norm(x.name) === key);
        clientId = existing?.id ?? (await tx.client.create({ data: { name, phone: str(c.Telephone) } })).id;
        add(existing ? "clients déjà dans le portail (reliés)" : "clients créés dans le portail");
      } else add("clients déjà importés");

      // Site
      const siteUrl = url(c.Site_Web);
      const sites = await tx.site.findMany({ where: { clientId }, select: { id: true, url: true } });
      const host = siteUrl ? new URL(siteUrl).hostname.replace(/^www\./, "") : null;
      let siteId = sites.find((s) => host && s.url?.includes(host))?.id ?? sites[0]?.id ?? null;
      if (!siteId) {
        const start = date(c.Date_Debut_Contrat);
        siteId = (await tx.site.create({ data: { clientId, name: host ?? name, url: siteUrl, status: siteUrl ? "EN_LIGNE" : "EN_CREATION", projectStep: siteUrl ? "LIVRAISON" : "PREPARATION_V1", launchedAt: siteUrl ? start : null } })).id;
        add("sites créés");
      }

      // Abonnement
      const tarif = num(c.Tarif_Mensuel);
      if (tarif && !(await tx.subscription.findFirst({ where: { clientId, billing: "MENSUEL" } }))) {
        await tx.subscription.create({ data: { clientId, siteId, label: "Abonnement site", billing: "MENSUEL", priceCents: Math.round(tarif * 100), startedAt: date(c.Date_Debut_Contrat) ?? new Date(), commitmentEndsAt: date(c.Engage_jusqu_au) } });
        add("abonnements créés");
      }

      // Fiche commerciale gagnée, reliée au client
      if (!prospect) {
        prospect = await tx.prospect.create({ data: { legacyId: legacyProspectId, societe: name, telephone: phone(c.Telephone), siteWeb: siteUrl, statut: "GAGNE" } });
        add("fiches clients créées");
      }
      if (!prospect.clientId) {
        await tx.prospect.update({ where: { id: prospect.id }, data: { clientId, statut: "GAGNE", gagneAt: prospect.gagneAt ?? date(c.Date_Debut_Contrat), mensuelEuros: prospect.mensuelEuros ?? (tarif ? Math.round(tarif) : null), commercialId: prospect.commercialId ?? userId(c.ID_Referent) } });
      }
      const known = await tx.prospectContact.findMany({ where: { prospectId: prospect.id }, select: { email: true, nom: true } });
      for (const k of todoContacts.filter((k) => str(k.ID_Client) === legacyId)) {
        const email = str(k.Email)?.toLowerCase() ?? null, nom = str(k.Nom);
        if (known.some((x) => (email && x.email === email) || (nom && x.nom && norm(x.nom) === norm(nom)))) continue;
        await tx.prospectContact.create({ data: { prospectId: prospect.id, prenom: str(k.Prenom), nom, fonction: str(k.Fonction), email, telephone: phone(k.Telephone), principal: bool(k.Est_Principal) } });
        add("contacts clients");
      }
      const ref = { clientId, siteId };
      clientByLegacy.set(legacyId, ref); seen.set(key, ref);
    }

    // 4. Échanges avec les clients (mails, appels)
    for (const e of need(todo, "Historique_Echanges")) {
      const legacyId = str(e.ID_Echange); if (!legacyId) continue;
      if (await tx.echange.findUnique({ where: { legacyId } })) continue;
      const ref = clientByLegacy.get(str(e.ID_Client) ?? "");
      if (!ref) { add("échanges clients ignorés (client interne ou inconnu)"); continue; }
      const t = norm(str(e.Type_Contact) ?? "");
      const auteur = str(e.Auteur);
      const auteurId = auteur ? userId(auteur) : null;
      await tx.echange.create({ data: { legacyId, clientId: ref.clientId, type: t === "appel" ? "APPEL" : t === "mail" ? "MAIL" : "NOTE", notes: str(e.Compte_Rendu), date: date(e.Date_Echange) ?? new Date(), auteurId, auteurNom: auteurId ? null : auteur, origine: "import" } });
      add("échanges clients");
    }

    // 5. Modèles
    const modeleIds = new Map<string, string>();
    for (const m of need(todo, "Modeles_Projets")) {
      const legacyId = str(m.ID_Modele_Projet); if (!legacyId) continue;
      const nom = str(m.Nom_Modele) ?? "Modèle";
      const row = await tx.projetModele.upsert({ where: { legacyId }, create: { legacyId, nom, description: str(m.Description) }, update: {} });
      modeleIds.set(legacyId, row.id); add("modèles de projet");
    }
    async function modeleFor(legacy: string | null) {
      if (!legacy) return null;
      if (!modeleIds.has(legacy)) {
        const row = await tx.projetModele.upsert({ where: { legacyId: legacy }, create: { legacyId: legacy, nom: "Tâches récurrentes (import)" }, update: {} });
        modeleIds.set(legacy, row.id); add("modèles de projet");
      }
      return modeleIds.get(legacy)!;
    }
    const tacheModeleIds = new Map<string, string>();
    let ordre = 0;
    for (const t of need(todo, "Modeles_Taches")) {
      const legacyId = str(t.ID_Modele); const modeleId = await modeleFor(str(t.ID_Modele_Projet));
      if (!legacyId || !modeleId) continue;
      const row = await tx.tacheModele.upsert({
        where: { legacyId },
        create: {
          legacyId, modeleId, titre: str(t.Nom_Prestation) ?? "Tâche", description: str(t.Description), responsableId: userId(t.Attribue_A),
          priorite: PRIORITE[norm(str(t.Priorite) ?? "moyenne")] ?? "MOYENNE", recurrence: RECURRENCE[norm(str(t.Type_Frequence) ?? "ponctuel")] ?? "PONCTUEL",
          jourSemaine: JOURS[norm(str(t.Jour_Semaine) ?? "")] ?? null, jourMois: num(t.Jour_Mois), positionMois: POSITION[norm(str(t.Position_Mois) ?? "")] ?? null, ordre: ordre++,
        },
        update: {},
      });
      tacheModeleIds.set(legacyId, row.id); add("modèles de tâche");
    }
    let sOrdre = 0;
    for (const s of need(todo, "Modeles_Sous_Taches")) {
      const legacyId = str(s.ID_Modele_Sous_Tache), tacheId = tacheModeleIds.get(str(s.ID_Modele_Tache) ?? "");
      if (!legacyId || !tacheId) continue;
      await tx.sousTacheModele.upsert({ where: { legacyId }, create: { legacyId, tacheId, intitule: str(s.Intitule_Sous_Tache) ?? "", ordre: sOrdre++ }, update: {} });
      add("modèles de sous-tâche");
    }

    // 6. Projets (+ brief), tâches, sous-tâches
    const briefs = new Map<string, Prisma.InputJsonObject>();
    for (const b of need(todo, "Brief")) {
      const projet = str(b.ID_Projet); if (!projet) continue;
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(b)) { if (k === "ID Brief" || k === "ID_Projet") continue; const s = v instanceof Date ? v.toISOString().slice(0, 10) : str(v); if (s) data[k.trim()] = s; }
      briefs.set(projet, data);
    }
    const projetIds = new Map<string, string>();
    for (const p of need(todo, "Projets")) {
      const legacyId = str(p.ID_Projet); if (!legacyId) continue;
      const ref = clientByLegacy.get(str(p.ID_Client) ?? "");
      const row = await tx.projet.upsert({
        where: { legacyId },
        create: {
          legacyId, clientId: ref?.clientId ?? null, siteId: ref?.siteId ?? null, modeleId: await modeleFor(str(p.ID_Modele_Projet)),
          nom: str(p.Nom_Projet) ?? "Projet", description: str(p.Description), statut: PROJET_STATUT[norm(str(p.Statut) ?? "en cours")] ?? "EN_COURS",
          priorite: PRIORITE[norm(str(p.Priorite) ?? "moyenne")] ?? "MOYENNE", debut: date(p.Date_Debut), echeance: date(p.Date_Echeance),
          responsableId: userId(p.ID_Referent), brief: briefs.get(legacyId),
        },
        update: {},
      });
      projetIds.set(legacyId, row.id); add("projets");
    }
    const tacheIds = new Map<string, string>();
    for (const t of need(todo, "Taches")) {
      const legacyId = str(t.ID_Tache); if (!legacyId) continue;
      const modeleId = tacheModeleIds.get(str(t.ID_Modele) ?? "") ?? null;
      const modele = modeleId ? await tx.tacheModele.findUnique({ where: { id: modeleId } }) : null;
      const fait = norm(str(t.Statut) ?? "") === "fait";
      const row = await tx.tache.upsert({
        where: { legacyId },
        create: {
          legacyId, projetId: projetIds.get(str(t.ID_Projet) ?? "") ?? null, modeleId, titre: str(t.Titre) ?? "Tâche", description: str(t.Description),
          responsableId: userId(t.Attribue_A), statut: fait ? "FAIT" : "A_FAIRE", priorite: PRIORITE[norm(str(t.Priorite) ?? "moyenne")] ?? "MOYENNE",
          debut: date(t.Date_Debut), echeance: date(t.Date_Echeance), faitLe: fait ? date(t.Date_Fait) : null,
          recurrence: modele?.recurrence ?? "PONCTUEL", jourSemaine: modele?.jourSemaine ?? null, jourMois: modele?.jourMois ?? null, positionMois: modele?.positionMois ?? null,
        },
        update: {},
      });
      tacheIds.set(legacyId, row.id); add("tâches");
    }
    let stOrdre = 0;
    for (const s of need(todo, "Sous_Taches")) {
      const legacyId = str(s.ID_Sous_Tache), tacheId = tacheIds.get(str(s.ID_Tache) ?? "");
      if (!legacyId || !tacheId) continue;
      await tx.sousTache.upsert({ where: { legacyId }, create: { legacyId, tacheId, titre: str(s.Titre) ?? "", fait: bool(s.Est_Fait), ordre: stOrdre++ }, update: {} });
      add("sous-tâches");
    }

    if (missing.size) warnings.push(`Comptes équipe introuvables (laissés « sans commercial ») : ${[...missing].join(", ")}. Créez-les dans l'espace Commercial → Équipe puis relancez l'import : seules les nouvelles lignes sont ajoutées.`);
    if (!confirm) throw new Preview();
  }, { timeout: 600_000, maxWait: 30_000 });
} catch (e) {
  if (!(e instanceof Preview)) { console.error("✗ Import interrompu, rien n'a été gardé :", (e as Error).message); await prisma.$disconnect(); process.exit(1); }
}

console.log(confirm ? "\n✓ Import terminé :" : "\nAperçu (rien n'a été gardé) :");
for (const [k, v] of Object.entries(counts)) console.log(`  ${String(v).padStart(4)}  ${k}`);
for (const w of warnings) console.log(`\n⚠ ${w}`);
console.log(confirm ? "\nAucun mail ni notification n'a été envoyé.\n" : "\nPour importer pour de bon : relancer avec --confirmer\n");
await prisma.$disconnect();
