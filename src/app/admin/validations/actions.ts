"use server";

import { revalidatePath } from "next/cache";
import { requireTeam } from "@/lib/auth";
import { decider } from "@/lib/validations";

/** Décision en un clic depuis l'accueil ou la page Validations. */
export async function deciderValidation(id: string, statut: "VALIDEE" | "REFUSEE", motif?: string | null) {
  const me = await requireTeam();
  const r = await decider(id, me, statut, motif?.trim() || null);
  revalidatePath("/admin", "layout");
  return r ? { ok: true as const } : { error: "Cette validation ne vous est pas confiée ou a déjà été décidée." };
}
