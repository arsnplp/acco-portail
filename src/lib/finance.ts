/**
 * Finance V1 (00.10, 16.3) : MRR des contrats signés, charges saisies, résultat mensuel estimé, rentabilité par client,
 * impayés signalés. Estimations basées sur les saisies, jamais une comptabilité (Pennylane fait foi).
 */
import { prisma } from "@/lib/prisma";

export const CATEGORIES: Record<string, string> = { logiciels: "Logiciels et abonnements", salaires: "Salaires et alternants", local: "Local", sous_traitance: "Sous-traitance récurrente", marketing: "Marketing", autre: "Autre" };
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const debutMois = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const moisSuivant = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

/** MRR = montants mensuels HT des contrats signés et non terminés ; à défaut de contrat, abonnements mensuels actifs sans contrat (import manuel). */
export async function mrrActuel() {
  const [contrats, subs] = await Promise.all([
    prisma.contrat.findMany({ where: { statut: "SIGNE" }, select: { id: true, clientId: true, montantMensuelHt: true, signeAt: true, finEngagement: true } }),
    prisma.subscription.findMany({ where: { status: "ACTIF", billing: "MENSUEL", contratId: null }, select: { clientId: true, priceCents: true } }),
  ]);
  const parClient = new Map<string, number>();
  for (const c of contrats) if (c.clientId) parClient.set(c.clientId, (parClient.get(c.clientId) ?? 0) + c.montantMensuelHt);
  for (const s of subs) parClient.set(s.clientId, (parClient.get(s.clientId) ?? 0) + s.priceCents);
  const total = [...parClient.values()].reduce((a, b) => a + b, 0);
  return { total, parClient, contrats };
}

/** Charges d'un mois donné (récurrentes actives ce mois + ponctuelles du mois). */
export function chargesPourMois(charges: { type: "MENSUELLE" | "PONCTUELLE"; montantCents: number; debut: Date; fin: Date | null; categorie: string; principale: boolean }[], mois: Date) {
  const d0 = debutMois(mois), d1 = moisSuivant(mois);
  const actives = charges.filter((c) => (c.type === "MENSUELLE" ? c.debut < d1 && (!c.fin || c.fin >= d0) : c.debut >= d0 && c.debut < d1));
  const total = actives.reduce((a, c) => a + c.montantCents, 0);
  const principales = actives.filter((c) => c.principale).reduce((a, c) => a + c.montantCents, 0);
  const parCategorie: Record<string, number> = {};
  for (const c of actives) parCategorie[c.categorie] = (parCategorie[c.categorie] ?? 0) + c.montantCents;
  return { total, principales, parCategorie };
}

/** Vision 00.10 §5 : MRR, nouveau MRR, MRR perdu, charges, résultat estimé, 12 mois d'historique et 3 mois de projection. */
export async function visionFinanciere(now = new Date()) {
  const [{ total: mrr, contrats, parClient }, charges, ponctuelsSignes, termines, impayes] = await Promise.all([
    mrrActuel(),
    prisma.charge.findMany({ where: { archivedAt: null } }),
    prisma.contrat.findMany({ where: { statut: { in: ["SIGNE", "TERMINE"] }, signeAt: { not: null }, montantPonctuelHt: { gt: 0 } }, select: { montantPonctuelHt: true, signeAt: true } }),
    prisma.contrat.findMany({ where: { statut: "TERMINE" }, select: { montantMensuelHt: true, updatedAt: true } }),
    prisma.contrat.findMany({ where: { impayeAt: { not: null }, regulariseAt: null }, select: { id: true, reference: true, montantMensuelHt: true, impayeAt: true, client: { select: { id: true, name: true } } } }),
  ]);
  const ceMois = debutMois(now), prochain = moisSuivant(now);
  const nouveauMrr = contrats.filter((c) => c.signeAt && c.signeAt >= ceMois && c.signeAt < prochain).reduce((a, c) => a + c.montantMensuelHt, 0);
  const mrrPerdu = termines.filter((c) => c.updatedAt >= ceMois && c.updatedAt < prochain).reduce((a, c) => a + c.montantMensuelHt, 0);
  const chargesMois = chargesPourMois(charges, now);
  const ponctuelMois = ponctuelsSignes.filter((c) => c.signeAt! >= ceMois && c.signeAt! < prochain).reduce((a, c) => a + c.montantPonctuelHt, 0);
  // Courbe : 12 mois passés (MRR reconstitué d'après les dates de signature / fin) + 3 mois de projection (contrats en cours, charges connues).
  const points: { key: string; label: string; values: Record<string, number> }[] = [];
  for (let i = -11; i <= 3; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)), f = moisSuivant(d);
    const mrrMois = contrats.filter((c) => c.signeAt && c.signeAt < f && (!c.finEngagement || c.finEngagement >= d || i <= 0)).reduce((a, c) => a + c.montantMensuelHt, 0);
    const ponct = ponctuelsSignes.filter((c) => c.signeAt! >= d && c.signeAt! < f).reduce((a, c) => a + c.montantPonctuelHt, 0);
    const ch = chargesPourMois(charges, d).total;
    points.push({ key: d.toISOString().slice(0, 7), label: `${MOIS[d.getUTCMonth()]}${d.getUTCMonth() === 0 || i === -11 ? ` ${String(d.getUTCFullYear()).slice(2)}` : ""}${i > 0 ? " (proj.)" : ""}`, values: { revenus: Math.round((mrrMois + ponct) / 100), charges: Math.round(ch / 100), resultat: Math.round((mrrMois + ponct - ch) / 100) } });
  }
  return { mrr, nouveauMrr, mrrPerdu, chargesMois, ponctuelMois, resultat: mrr + ponctuelMois - chargesMois.total, points, impayes, parClient, clientsActifs: parClient.size };
}

/** Rentabilité par client (16.6, V1) : revenu contractuel mensuel moins coûts saisis sur ses projets (charges rattachées). */
export async function rentabiliteParClient() {
  const [{ parClient }, clients, couts] = await Promise.all([
    mrrActuel(),
    prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, logoMiniPath: true, commercial: { select: { firstName: true, email: true } }, createdAt: true, contrats: { where: { statut: "SIGNE" }, select: { impayeAt: true, regulariseAt: true, montantPonctuelHt: true } }, sites: { select: { status: true } } } }),
    prisma.charge.groupBy({ by: ["clientId"], where: { archivedAt: null, clientId: { not: null }, type: "MENSUELLE", OR: [{ fin: null }, { fin: { gte: new Date() } }] }, _sum: { montantCents: true } }),
  ]);
  const coutPar = new Map(couts.map((c) => [c.clientId!, c._sum.montantCents ?? 0]));
  return clients.map((c) => {
    const mensuel = parClient.get(c.id) ?? 0, cout = coutPar.get(c.id) ?? 0;
    return { id: c.id, name: c.name, logo: c.logoMiniPath, referent: c.commercial, mensuel, ponctuel: c.contrats.reduce((a, x) => a + x.montantPonctuelHt, 0), coutsMensuels: cout, marge: mensuel - cout, impaye: c.contrats.some((x) => x.impayeAt && !x.regulariseAt), sitesEnLigne: c.sites.filter((s) => s.status === "EN_LIGNE").length, depuis: c.createdAt };
  }).sort((a, b) => b.mensuel - a.mensuel);
}
