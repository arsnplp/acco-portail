"use server";

import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export type ForgotState = { ok?: boolean; error?: string; email?: string };

export async function requestReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Entrez une adresse email valide." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/nouveau-mot-de-passe")}` });
  if (error) console.warn("[mdp oublié]", error.message);
  return { ok: true, email }; // même réponse que l'adresse existe ou non
}
