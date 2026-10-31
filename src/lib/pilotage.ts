/**
 * Pilotage (Direction) : MRR et projection, activité par collaborateur.
 * MRR = abonnements mensuels actifs. Projection : on garde le MRR courant, on retire les abonnements dont l'engagement se
 * termine (risque de résiliation) et on ajoute le pipeline pondéré (RDV posé 25 %, à signer 60 % du potentiel mensuel).
 */
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/roles";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const PONDERATION: Record<string, number> = { RDV_POSE: 0.25, A_SIGNER: 0.6 };

export async function projectionMrr(now = new Date(), mois = 6) {
  const [subs, pipeline] = await Promise.all([
    prisma.subscription.findMany({ where: { status: "ACTIF", billing: "MENSUEL" }, select: { priceCents: true, commitmentEndsAt: true } }),
    prisma.prospect.findMany({ where: { statut: { in: ["RDV_POSE", "A_SIGNER"] } }, select: { statut: true, potentielEuros: true, mensuelEuros: true } }),
  ]);
  const mrr = subs.reduce((a, s) => a + s.priceCents, 0) / 100;
  const pondere = pipeline.reduce((a, p) => a + (p.mensuelEuros ?? p.potentielEuros ?? 0) * (PONDERATION[p.statut] ?? 0), 0);
  const points: { key: string; label: string; values: Record<string, number> }[] = [];
  for (let i = 0; i <= mois; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const fin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 1));
    const aRisque = subs.filter((s) => s.commitmentEndsAt && s.commitmentEndsAt < fin).reduce((a, s) => a + s.priceCents, 0) / 100;
    points.push({ key: d.toISOString().slice(0, 7), label: `${MOIS[d.getUTCMonth()]}${d.getUTCMonth() === 0 || i === 0 ? ` ${String(d.getUTCFullYear()).slice(2)}` : ""}`, values: { acquis: Math.round(mrr - aRisque), risque: Math.round(aRisque), pipeline: i === 0 ? 0 : Math.round(pondere * Math.min(1, i / 3)) } });
  }
  return { mrr: Math.round(mrr), pondere: Math.round(pondere), aRisque3Mois: points[3]?.values.risque ?? 0, points };
}

/** Activité des 30 derniers jours par collaborateur : appels, RDV, signatures, modifications terminées, actions. */
export async function activiteParCollaborateur(jours = 30, now = new Date()) {
  const since = new Date(now.getTime() - jours * 86400_000);
  const [equipe, echanges, rdv, gagnes, modifs, actions] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: MODULES.suivi } }, orderBy: [{ role: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, email: true, role: true, _count: { select: { clientsSuivis: true, sitesDeveloppes: true } } } }),
    prisma.echange.groupBy({ by: ["auteurId"], where: { date: { gte: since }, auteurId: { not: null }, type: { in: ["NRP", "APPEL", "PRISE_RDV", "MAIL", "PP", "RDV"] } }, _count: true }),
    prisma.rendezVous.groupBy({ by: ["commercialId"], where: { createdAt: { gte: since }, commercialId: { not: null }, reportDeId: null, resultat: { notIn: ["ANNULE", "NO_SHOW"] } }, _count: true }),
    prisma.prospect.findMany({ where: { statut: "GAGNE", gagneAt: { gte: since }, commercialId: { not: null } }, select: { commercialId: true, fraisCreationEuros: true, mensuelEuros: true } }),
    prisma.changeRequest.groupBy({ by: ["assigneeId"], where: { completedAt: { gte: since }, assigneeId: { not: null } }, _count: true }),
    prisma.activite.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, userId: { not: null } }, _count: true }),
  ]);
  const n = (rows: { _count: number }[], find: (r: never) => boolean) => (rows as never[]).filter(find).reduce((a, r) => a + (r as { _count: number })._count, 0);
  return equipe.map((u) => ({
    id: u.id, nom: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email, role: u.role,
    echanges: n(echanges, (r) => (r as { auteurId: string | null }).auteurId === u.id),
    rdv: n(rdv, (r) => (r as { commercialId: string | null }).commercialId === u.id),
    signatures: gagnes.filter((g) => g.commercialId === u.id).length,
    ca: gagnes.filter((g) => g.commercialId === u.id).reduce((a, g) => a + (g.fraisCreationEuros ?? 0) + 12 * (g.mensuelEuros ?? 0), 0),
    modifs: n(modifs, (r) => (r as { assigneeId: string | null }).assigneeId === u.id),
    actions: n(actions, (r) => (r as { userId: string | null }).userId === u.id),
    clients: u._count.clientsSuivis, sites: u._count.sitesDeveloppes,
  }));
}
