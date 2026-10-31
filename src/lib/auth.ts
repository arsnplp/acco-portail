import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { EQUIPE, canAccess, homeFor, type Module } from "@/lib/roles";
import type { Role } from "@prisma/client";

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
      role: EQUIPE.includes(meta.role as Role) ? (meta.role as Role) : "CLIENT",
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

/** Accès à un module ; sinon renvoi vers l'accueil du rôle. */
export async function requireModule(module: Module) {
  const user = await requireUser();
  if (!canAccess(user.role, module)) redirect(homeFor(user.role));
  return user;
}
/** Direction uniquement (Pilotage, équipe, réglages sensibles). */
export const requireAdmin = () => requireModule("pilotage");
/** Prospection (CRM) : Direction et Commerciaux. */
export const requireProspection = () => requireModule("prospection");

export { isGestionnaire } from "@/lib/roles";
import { isGestionnaire } from "@/lib/roles";

export async function requireGestionnaire() {
  const user = await requireAdmin();
  if (!isGestionnaire(user)) redirect("/admin/parametres");
  return user;
}

/** Suivi : toute l'équipe (Direction, commerciaux, développeurs, experts, spécialistes), jamais les clients. */
export const requireTeam = () => requireModule("suivi");

/** Client (entreprise) actif pour un utilisateur côté client. */
export async function requireClientContext() {
  const user = await requireUser();
  if (user.role !== "CLIENT") redirect(homeFor(user.role));
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
