/**
 * Tâches automatiques liées aux contrats (5.2 F, 5.3) : relance humaine des contrats envoyés non signés après 7 jours,
 * alerte interne J-90 avant la fin d'engagement. Jamais d'email au client sans clic.
 */
import { prisma } from "@/lib/prisma";
import { creerTache } from "@/lib/taches-client";
import { fmtDate } from "@/lib/format";

export async function tachesContrats(now = new Date()) {
  let creees = 0;
  // Relances : contrat envoyé ou consulté depuis plus de 7 jours, toujours ouvert.
  const ouverts = await prisma.contrat.findMany({ where: { statut: { in: ["ENVOYE", "CONSULTE"] }, envoyeAt: { lt: new Date(now.getTime() - 7 * 86400_000) }, clientId: { not: null } }, select: { id: true, reference: true, clientId: true, siteId: true, commercialId: true, envoyeAt: true } });
  for (const c of ouverts) {
    const t = await creerTache({ clientId: c.clientId!, siteId: c.siteId, contratId: c.id, type: "RELANCE", titre: `Relancer le contrat ${c.reference} (envoyé le ${c.envoyeAt ? fmtDate(c.envoyeAt) : "—"})`, description: "Relance à faire par une personne : bouton « Relancer » sur le contrat.", echeance: now, responsableId: c.commercialId, source: "contrat", notifier: true });
    if (t.createdAt.getTime() > now.getTime() - 60_000) creees++;
  }
  // J-90 : prendre la température avant l'échéance (aucune question automatique au client).
  const j90 = new Date(now.getTime() + 90 * 86400_000);
  const echeances = await prisma.contrat.findMany({ where: { statut: "SIGNE", finEngagement: { gte: now, lte: j90 }, clientId: { not: null } }, select: { id: true, reference: true, clientId: true, siteId: true, commercialId: true, finEngagement: true } });
  for (const c of echeances) {
    const t = await creerTache({ clientId: c.clientId!, siteId: c.siteId, contratId: c.id, type: "APPEL", titre: `Échéance du contrat ${c.reference} le ${fmtDate(c.finEngagement!)} : prendre la température`, description: "Alerte interne J-90 : appeler le client pour faire le point, sans lui demander automatiquement s’il reste.", echeance: new Date(c.finEngagement!.getTime() - 75 * 86400_000), responsableId: c.commercialId, source: "contrat", notifier: true });
    if (t.createdAt.getTime() > now.getTime() - 60_000) creees++;
  }
  return { creees, ouverts: ouverts.length, echeances: echeances.length };
}

export function startContratsTicker() {
  const g = globalThis as { __contratsTicker?: NodeJS.Timeout };
  if (g.__contratsTicker) return;
  const tick = () => tachesContrats().catch((e) => console.warn("[contrats]", (e as Error).message));
  setTimeout(tick, 90_000);
  g.__contratsTicker = setInterval(tick, 12 * 3600_000);
}
