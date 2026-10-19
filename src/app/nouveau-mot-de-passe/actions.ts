"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/password";

export type NewPasswordState = { error?: string };

export async function setPassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "Les deux mots de passe ne sont pas identiques." };
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?erreur=lien-invalide");
  const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
  if (error) return { error: error.message.includes("different") ? "Choisissez un mot de passe différent de l’ancien." : "Impossible d’enregistrer ce mot de passe." };
  redirect(String(formData.get("next") ?? "/") || "/");
}
