/**
 * Les commerciaux de l'agence, pour toutes les listes où l'on choisit ou évalue un commercial (pipeline, fiches, filtres,
 * statistiques, Pilotage) : les membres de l'équipe Commerciale (Bilel, Lucas et les commerciaux), jamais le gestionnaire
 * ni l'équipe Production, même s'ils ont accès à la Prospection par leur casquette Direction.
 */
import { prisma } from "@/lib/prisma";
import { EQUIPE, SELECT_EQUIPE, estCommercial } from "@/lib/roles";

export type Commercial = { id: string; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null; role: "ADMIN" | "COMMERCIAL" | "DEV" | "EXPERT" | "SPECIALISTE" | "CLIENT" };

export async function commerciaux(): Promise<Commercial[]> {
  const users = await prisma.user.findMany({ where: { role: { in: EQUIPE } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, avatarUrl: true, ...SELECT_EQUIPE } });
  return users.filter(estCommercial).map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, avatarUrl: u.avatarUrl, role: u.role }));
}
