"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { recordLogin } from "@/lib/login-log";

export type LoginState = { error?: string; email?: string };

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!z.string().email().safeParse(email).success) return { error: "Entrez une adresse email valide.", email };
  if (!password) return { error: "Entrez votre mot de passe.", email };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email ou mot de passe incorrect.", email };
  if (data.user) await recordLogin(data.user.id, (await headers()).get("user-agent"));
  redirect(next.startsWith("/") ? next : "/");
}
