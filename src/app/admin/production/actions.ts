"use server";

import { revalidatePath } from "next/cache";
import type { DifficulteStatut } from "@prisma/client";
import { requireTeam } from "@/lib/auth";
import { majDifficulte } from "@/lib/difficultes";

export type DifficulteAdminState = { error?: string; ok?: string };

/** Traitement d'une difficulté signalée par un client : prise en charge, réponse, résolution. Toute l'équipe interne. */
export async function traiterDifficulte(id: string, _prev: DifficulteAdminState, fd: FormData): Promise<DifficulteAdminState> {
  const me = await requireTeam();
  const statut = String(fd.get("statut") ?? "") as DifficulteStatut;
  if (!["RECUE", "EN_COURS", "RESOLUE"].includes(statut)) return { error: "État inconnu." };
  await majDifficulte(id, { statut, reponse: String(fd.get("reponse") ?? ""), userId: me.id });
  revalidatePath("/admin/production"); revalidatePath("/admin/clients", "layout"); revalidatePath("/difficultes"); revalidatePath("/");
  return { ok: "Enregistré, le client est prévenu." };
}
