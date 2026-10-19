"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!z.string().email().safeParse(email).success) return { error: "Entrez une adresse email valide.", email };
  if (!password) return { error: "Entrez votre mot de passe.", email };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email ou mot de passe incorrect.", email };
  redirect(next.startsWith("/") ? next : "/");
}
