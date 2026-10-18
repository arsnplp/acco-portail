"use server";

import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export type LoginState = { ok?: boolean; error?: string; email?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.string().email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Entrez une adresse email valide." };
  const email = parsed.data;

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    // Ne pas révéler si l'adresse existe : même message dans tous les cas.
    console.warn("[connexion]", error.message);
  }
  return { ok: true, email };
}
