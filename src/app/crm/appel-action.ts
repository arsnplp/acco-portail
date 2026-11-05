"use server";

import { getCurrentUser } from "@/lib/auth";
import { lancerAppel, type LancerAppel } from "@/lib/aircall";

/** Click-to-call : lance l'appel dans Aircall Workspace du collaborateur connecté (voir BoutonAppel). */
export async function appelerAircall(tel: string): Promise<LancerAppel> {
  const me = await getCurrentUser();
  if (!me || me.role === "CLIENT") return { ok: false, raison: "erreur", message: "Non autorisé." };
  return lancerAppel(me.email, tel);
}
