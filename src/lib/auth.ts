import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

export const CLIENT_COOKIE = "acco_client";

/**
 * Utilisateur courant : lit la session Supabase puis la ligne `User` de l'app.
 * Crée la ligne à la première connexion (prénom/nom pris dans les métadonnées d'invitation).
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const email = authUser.email!.toLowerCase();
  const meta = (authUser.user_metadata ?? {}) as Record<string, string | undefined>;

  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    create: {
      id: authUser.id,
      email,
      firstName: meta.first_name ?? null,
      lastName: meta.last_name ?? null,
      role: meta.role === "ADMIN" ? "ADMIN" : meta.role === "COMMERCIAL" ? "COMMERCIAL" : "CLIENT",
    },
    update: { email },
    include: { memberships: { include: { client: true }, orderBy: { createdAt: "asc" } } },
  });
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role === "COMMERCIAL") redirect("/crm");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Équipe (admins + commerciaux / alternants) : accès à l'espace Commercial. */
export async function requireTeam() {
  const user = await requireUser();
  if (user.role === "CLIENT") redirect("/");
  return user;
}

/** Client (entreprise) actif pour un utilisateur côté client. */
export async function requireClientContext() {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "COMMERCIAL") redirect("/crm");
  if (user.memberships.length === 0) redirect("/connexion?erreur=aucun-compte");

  const cookieStore = await cookies();
  const wanted = cookieStore.get(CLIENT_COOKIE)?.value;
  const membership = user.memberships.find((m) => m.clientId === wanted) ?? user.memberships[0];
  return { user, client: membership.client, membership };
}

export function displayName(u: { firstName: string | null; lastName: string | null; email: string }) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export function initials(u: { firstName: string | null; lastName: string | null; email: string }) {
  const s = `${u.firstName ?? ""}${u.lastName ? " " + u.lastName : ""}`.trim() || u.email;
  return s.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
