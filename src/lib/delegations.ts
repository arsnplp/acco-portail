/** Délégation temporaire d'un portefeuille (section 3.3) : le délégataire agit à la place du référent jusqu'à la date de fin. */
import { prisma } from "@/lib/prisma";

export async function delegationsActives(userId: string, now = new Date()) {
  return prisma.delegation.findMany({ where: { versId: userId, debut: { lte: now }, fin: { gte: now } }, select: { deId: true, clientId: true } });
}
/** Le membre agit-il comme référent de ce client (référent lui-même, ou délégataire actif) ? */
export async function agitCommeReferent(userId: string, client: { id: string; commercialId: string | null }, now = new Date()) {
  if (client.commercialId === userId) return true;
  if (!client.commercialId) return false;
  const d = await prisma.delegation.count({ where: { versId: userId, deId: client.commercialId, debut: { lte: now }, fin: { gte: now }, OR: [{ clientId: null }, { clientId: client.id }] } });
  return d > 0;
}
/** Identifiants des commerciaux dont ce membre porte le portefeuille (lui-même + délégations actives). */
export async function portefeuilleDe(userId: string, now = new Date()) {
  const d = await delegationsActives(userId, now);
  return [userId, ...d.filter((x) => !x.clientId).map((x) => x.deId)];
}
