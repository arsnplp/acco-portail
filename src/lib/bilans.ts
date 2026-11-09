/**
 * Bilans individuels des commerciaux : périodes (semaine, mois, trimestre, année), indicateurs lus dans Prospection et Suivi
 * (aucune double saisie), trois objectifs par indicateur (personnel, engagement, fixé par le responsable) et comptes rendus.
 * Chaque résultat renvoie la liste détaillée des éléments comptés (RDV, contrats, appels) pour les vues cliquables.
 */
import type { EchangeType, PeriodeBilan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PERIODES: { key: PeriodeBilan; label: string; pluriel: string }[] = [
  { key: "HEBDO", label: "Semaine", pluriel: "hebdomadaires" }, { key: "MENSUEL", label: "Mois", pluriel: "mensuels" }, { key: "TRIMESTRIEL", label: "Trimestre", pluriel: "trimestriels" }, { key: "ANNUEL", label: "Année", pluriel: "annuels" },
];
export type Indicateur = "appels" | "rdv" | "signatures" | "ca";
export const INDICATEURS: { key: Indicateur; label: string; unite: string; aide: string }[] = [
  { key: "appels", label: "Appels", unite: "", aide: "Échanges notés NRP, Appel ou Prise de RDV (Aircall compris)" },
  { key: "rdv", label: "RDV obtenus", unite: "", aide: "Rendez-vous pris sur la période (hors no show, annulés et reports)" },
  { key: "signatures", label: "Contrats signés", unite: "", aide: "Fiches passées Gagné sur la période" },
  { key: "ca", label: "CA signé", unite: "€", aide: "Création + 12 mois d’abonnement des fiches gagnées" },
];
const APPELS: EchangeType[] = ["NRP", "APPEL", "PRISE_RDV"];

const j = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12));
/** Bornes d'une période contenant la date `d` (début inclus, fin exclue) et navigation. */
export function bornes(periode: PeriodeBilan, d: Date) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  let debut: Date, fin: Date, label: string;
  if (periode === "HEBDO") {
    const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
    debut = j(y, m, d.getUTCDate() - dow); fin = j(y, m, d.getUTCDate() - dow + 7);
    const f = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
    label = `Semaine du ${f.format(debut)} au ${f.format(new Date(fin.getTime() - 86400_000))}`;
  } else if (periode === "MENSUEL") {
    debut = j(y, m, 1); fin = j(y, m + 1, 1);
    label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(debut);
    label = label.charAt(0).toUpperCase() + label.slice(1);
  } else if (periode === "TRIMESTRIEL") {
    const t = Math.floor(m / 3); debut = j(y, t * 3, 1); fin = j(y, t * 3 + 3, 1); label = `T${t + 1} ${y}`;
  } else { debut = j(y, 0, 1); fin = j(y + 1, 0, 1); label = `Année ${y}`; }
  const precedent = new Date(debut.getTime() - 86400_000), suivant = fin;
  return { debut, fin, label, precedent: bornesDebut(periode, precedent), suivant: bornesDebut(periode, suivant), enCours: d >= debut && d < fin && new Date() < fin };
}
const bornesDebut = (p: PeriodeBilan, d: Date) => { const y = d.getUTCFullYear(), m = d.getUTCMonth(); if (p === "HEBDO") { const dow = (d.getUTCDay() + 6) % 7; return j(y, m, d.getUTCDate() - dow); } if (p === "MENSUEL") return j(y, m, 1); if (p === "TRIMESTRIEL") return j(y, Math.floor(m / 3) * 3, 1); return j(y, 0, 1); };
export const cle = (d: Date) => d.toISOString().slice(0, 10);
export const parseDebut = (s?: string) => { const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? j(+m[1], +m[2] - 1, +m[3]) : new Date(); };

export type Resultats = {
  appels: { id: string; date: Date; type: EchangeType; notes: string | null; prospectId: string | null; societe: string | null; clientId: string | null; clientNom: string | null }[];
  rdv: { id: string; debut: Date; resultat: string; prospectId: string | null; societe: string | null; clientId: string | null; clientNom: string | null; lieu: string | null }[];
  signatures: { id: string; societe: string; gagneAt: Date | null; clientId: string | null; ca: number; mensuel: number; creation: number; contrats: { id: string; reference: string }[] }[];
  valeurs: Record<Indicateur, number>;
};
/** Résultats réels d'un commercial sur [debut, fin[ : lus dans Prospection (échanges, RDV, fiches gagnées) et Suivi (contrats). */
export async function resultats(userId: string, debut: Date, fin: Date): Promise<Resultats> {
  const [echanges, rdvs, gagnes] = await Promise.all([
    prisma.echange.findMany({ where: { auteurId: userId, type: { in: APPELS }, date: { gte: debut, lt: fin } }, orderBy: { date: "desc" }, select: { id: true, date: true, type: true, notes: true, prospectId: true, clientId: true, prospect: { select: { societe: true } }, client: { select: { name: true } } } }),
    prisma.rendezVous.findMany({ where: { commercialId: userId, createdAt: { gte: debut, lt: fin }, resultat: { notIn: ["NO_SHOW", "ANNULE"] }, reportDeId: null }, orderBy: { debut: "desc" }, select: { id: true, debut: true, resultat: true, lieu: true, prospectId: true, clientId: true, prospect: { select: { societe: true } }, client: { select: { name: true } } } }),
    prisma.prospect.findMany({ where: { commercialId: userId, statut: "GAGNE", gagneAt: { gte: debut, lt: fin } }, orderBy: { gagneAt: "desc" }, select: { id: true, societe: true, gagneAt: true, clientId: true, mensuelEuros: true, fraisCreationEuros: true, contrats: { select: { id: true, reference: true } } } }),
  ]);
  const appels = echanges.map((e) => ({ id: e.id, date: e.date, type: e.type, notes: e.notes, prospectId: e.prospectId, societe: e.prospect?.societe ?? null, clientId: e.clientId, clientNom: e.client?.name ?? null }));
  const rdv = rdvs.map((r) => ({ id: r.id, debut: r.debut, resultat: r.resultat, lieu: r.lieu, prospectId: r.prospectId, societe: r.prospect?.societe ?? null, clientId: r.clientId, clientNom: r.client?.name ?? null }));
  const signatures = gagnes.map((p) => ({ id: p.id, societe: p.societe, gagneAt: p.gagneAt, clientId: p.clientId, mensuel: p.mensuelEuros ?? 0, creation: p.fraisCreationEuros ?? 0, ca: (p.fraisCreationEuros ?? 0) + 12 * (p.mensuelEuros ?? 0), contrats: p.contrats }));
  return { appels, rdv, signatures, valeurs: { appels: appels.length, rdv: rdv.length, signatures: signatures.length, ca: signatures.reduce((a, s) => a + s.ca, 0) } };
}

export type Objectifs = Record<Indicateur, { personnel: number | null; engagement: number | null; fixe: number | null }>;
export async function objectifs(userId: string, periode: PeriodeBilan, debut: Date): Promise<Objectifs> {
  const rows = await prisma.objectifCommercial.findMany({ where: { userId, periode, debut } });
  const o = Object.fromEntries(INDICATEURS.map((i) => [i.key, { personnel: null, engagement: null, fixe: null }])) as Objectifs;
  for (const r of rows) if (r.indicateur in o) o[r.indicateur as Indicateur] = { personnel: r.personnel, engagement: r.engagement, fixe: r.fixe };
  return o;
}
/** Écart et taux d'atteinte d'un résultat face à un objectif. */
export const atteinte = (resultat: number, objectif: number | null) => (objectif === null || objectif <= 0 ? null : { ecart: resultat - objectif, pct: Math.round((resultat / objectif) * 100) });
export const fmtVal = (ind: Indicateur, v: number) => (ind === "ca" ? `${Math.round(v).toLocaleString("fr-FR")} €` : String(v));

/** Historique : les `n` périodes précédentes (résultats + objectifs), de la plus récente à la plus ancienne. */
export async function historique(userId: string, periode: PeriodeBilan, debut: Date, n = 8) {
  const out: { debut: Date; label: string; valeurs: Record<Indicateur, number>; objectifs: Objectifs; bilans: number }[] = [];
  let d = bornes(periode, debut).precedent;
  for (let i = 0; i < n; i++) {
    const b = bornes(periode, d);
    const [r, o, bilans] = await Promise.all([resultats(userId, b.debut, b.fin), objectifs(userId, periode, b.debut), prisma.bilanCommercial.count({ where: { userId, periode, debut: b.debut } })]);
    out.push({ debut: b.debut, label: b.label, valeurs: r.valeurs, objectifs: o, bilans });
    d = b.precedent;
  }
  return out;
}
