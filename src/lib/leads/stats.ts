import type { ProspectStatut } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ListeStats = {
  envoyes: number; contactes: number; joints: number; appels: number; nrp: number; rdv: number; noShow: number;
  signes: number; perdus: number; ca: number; statuts: Partial<Record<ProspectStatut, number>>;
};

/** Résultats des leads envoyés dans le CRM, liste par liste. */
export async function listeStats(listeIds: string[]): Promise<Map<string, ListeStats>> {
  const out = new Map<string, ListeStats>();
  if (!listeIds.length) return out;
  const leads = await prisma.lead.findMany({
    where: { listeId: { in: listeIds }, prospectId: { not: null } },
    select: {
      listeId: true,
      prospect: {
        select: {
          statut: true, fraisCreationEuros: true, mensuelEuros: true,
          echanges: { where: { auteurId: { not: null }, type: { not: "NOTE" } }, select: { type: true } },
          rendezVous: { select: { resultat: true, reportDeId: true } },
        },
      },
    },
  });
  for (const id of listeIds) out.set(id, { envoyes: 0, contactes: 0, joints: 0, appels: 0, nrp: 0, rdv: 0, noShow: 0, signes: 0, perdus: 0, ca: 0, statuts: {} });
  for (const l of leads) {
    const s = out.get(l.listeId)!, p = l.prospect;
    if (!p) continue;
    s.envoyes++;
    s.statuts[p.statut] = (s.statuts[p.statut] ?? 0) + 1;
    if (p.echanges.length) s.contactes++;
    if (p.echanges.some((e) => e.type !== "NRP")) s.joints++;
    s.appels += p.echanges.filter((e) => e.type === "APPEL" || e.type === "NRP" || e.type === "PRISE_RDV").length;
    s.nrp += p.echanges.filter((e) => e.type === "NRP").length;
    s.rdv += p.rendezVous.filter((r) => r.resultat !== "NO_SHOW" && r.resultat !== "ANNULE" && !r.reportDeId).length;
    s.noShow += p.rendezVous.filter((r) => r.resultat === "NO_SHOW").length;
    if (p.statut === "GAGNE") { s.signes++; s.ca += (p.fraisCreationEuros ?? 0) + 12 * (p.mensuelEuros ?? 0); }
    if (p.statut === "PERDU") s.perdus++;
  }
  return out;
}
