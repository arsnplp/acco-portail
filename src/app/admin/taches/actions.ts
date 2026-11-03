"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { can, estExterne } from "@/lib/permissions";
import { requireClientAcces } from "@/lib/perimetre";
import { logActivite } from "@/lib/activite";
import { teamName } from "@/lib/crm";

export type TacheState = { error?: string };

/** Réattribution d'une tâche (section 7) : référent, responsable actuel ou droit attribuer ; historisée. */
export async function reattribuerTache(id: string, responsableId: string | null) {
  const me = await requireTeam();
  const t = await prisma.tacheClient.findUnique({ where: { id }, include: { responsable: { select: { firstName: true, email: true } }, client: { select: { commercialId: true } } } });
  if (!t) return;
  if (!can(me, "attribuer") && t.responsableId !== me.id && t.client.commercialId !== me.id) return;
  const nouveau = responsableId ? await prisma.user.findUnique({ where: { id: responsableId }, select: { firstName: true, email: true } }) : null;
  await prisma.tacheClient.update({ where: { id }, data: { responsableId } });
  await logActivite({ kind: "tache", texte: `Tâche « ${t.titre} » réattribuée : ${t.responsable ? teamName(t.responsable) : "personne"} → ${nouveau ? teamName(nouveau) : "personne"}`, href: "/admin/taches", userId: me.id, clientId: t.clientId, siteId: t.siteId });
  revalidatePath("/admin/taches"); revalidatePath(`/admin/clients/${t.clientId}`);
}
export async function changerStatutTache(id: string, statut: "FAIT" | "ANNULEE" | "A_FAIRE") {
  const me = await requireTeam();
  const t = await prisma.tacheClient.findUnique({ where: { id }, select: { clientId: true } });
  if (!t) return;
  await requireClientAcces(me, t.clientId);
  await prisma.tacheClient.update({ where: { id }, data: { statut, faitAt: statut === "FAIT" ? new Date() : null } });
  revalidatePath("/admin/taches"); revalidatePath(`/admin/clients/${t.clientId}`); revalidatePath("/admin");
}
export async function changerEcheanceTache(id: string, echeance: string, motif: string) {
  const me = await requireTeam();
  const t = await prisma.tacheClient.findUnique({ where: { id }, select: { clientId: true, titre: true, echeance: true } });
  if (!t) return;
  await requireClientAcces(me, t.clientId);
  const d = echeance ? new Date(`${echeance}T09:00:00`) : null;
  await prisma.tacheClient.update({ where: { id }, data: { echeance: d } });
  await logActivite({ kind: "tache", texte: `Échéance de « ${t.titre} » : ${t.echeance ? t.echeance.toLocaleDateString("fr-FR") : "—"} → ${d ? d.toLocaleDateString("fr-FR") : "—"}${motif ? ` · ${motif}` : ""}`, href: "/admin/taches", userId: me.id, clientId: t.clientId });
  revalidatePath("/admin/taches");
}
/** Création depuis le gestionnaire (client au choix) ; les externes ne créent pas de tâches commerciales. */
export async function creerTacheDepuisGestionnaire(_prev: TacheState, fd: FormData): Promise<TacheState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const clientId = String(fd.get("clientId") ?? "");
  const titre = String(fd.get("titre") ?? "").trim();
  if (!clientId || !titre) return { error: "Client et titre requis." };
  const { creerTache } = await import("@/lib/taches-client");
  const types = ["RELANCE", "RDV_A_PLANIFIER", "APPEL", "EMAIL", "DOCUMENT", "MAINTENANCE", "AUTRE"] as const;
  const type = String(fd.get("type") ?? "AUTRE");
  await creerTache({ clientId, titre, type: types.includes(type as (typeof types)[number]) ? (type as (typeof types)[number]) : "AUTRE", description: String(fd.get("description") ?? "").trim() || null, echeance: fd.get("echeance") ? new Date(`${fd.get("echeance")}T09:00:00`) : null, responsableId: String(fd.get("responsableId") ?? "") || me.id, source: "saisie", createdById: me.id, notifier: true });
  revalidatePath("/admin/taches");
  return {};
}
