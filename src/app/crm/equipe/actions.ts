"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ensureAuthUser } from "@/lib/invitations";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, layout, appUrl } from "@/lib/email";
import { EQUIPE, ROLE_LABEL, homeFor } from "@/lib/roles";

export type TeamState = { error?: string; ok?: string };

const ACCES: Record<Exclude<Role, "CLIENT">, string> = {
  ADMIN: "à tout l’outil Acco : Pilotage, Prospection et Suivi",
  COMMERCIAL: "à la Prospection (prospects, relances, rendez-vous) et au Suivi des clients",
  DEV: "au Suivi : les clients, leurs sites et la production",
  EXPERT: "au Suivi : les clients, leurs sites et la production",
  SPECIALISTE: "au Suivi : les clients, leurs sites et la production",
};

/** Crée le compte d'un membre de l'équipe avec son rôle (Direction seulement) et lui envoie son lien de connexion. */
export async function addTeamMember(_prev: TeamState, f: FormData): Promise<TeamState> {
  const admin = await requireAdmin();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const firstName = String(f.get("firstName") ?? "").trim() || null;
  const lastName = String(f.get("lastName") ?? "").trim() || null;
  const role = String(f.get("role") ?? "COMMERCIAL") as Role;
  if (!EQUIPE.includes(role)) return { error: "Choisissez un rôle." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Adresse email invalide." };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== "CLIENT") return { error: `Cette personne fait déjà partie de l’équipe (${ROLE_LABEL[existing.role]}). Changez son rôle dans la liste.` };
  if (existing?.role === "CLIENT" && existing.id) {
    const m = await prisma.clientMembership.count({ where: { userId: existing.id } });
    if (m > 0) return { error: "Cette adresse est un compte client. Utilisez une autre adresse pour l’équipe." };
  }

  let id: string;
  try { id = await ensureAuthUser(email, { first_name: firstName ?? undefined, last_name: lastName ?? undefined, role }); }
  catch (e) { return { error: (e as Error).message }; }
  await prisma.user.upsert({ where: { id }, create: { id, email, firstName, lastName, role }, update: { role, firstName: firstName ?? undefined, lastName: lastName ?? undefined } });

  const sb = createSupabaseAdmin();
  const { data } = await sb.auth.admin.generateLink({ type: "magiclink", email });
  const direct = data?.properties?.hashed_token ? appUrl(`/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(homeFor(role))}`) : appUrl("/connexion");
  const res = await sendEmail({
    to: email,
    subject: "Votre accès à l’outil Acco",
    html: layout(`Bienvenue${firstName ? ` ${firstName}` : ""}`, `
      <p>${admin.firstName ?? "L’équipe Acco"} vous donne accès ${ACCES[role as Exclude<Role, "CLIENT">]} (rôle : ${ROLE_LABEL[role]}).</p>
      <p style="font-size:13px;color:#71717a">Le bouton est valable 1 heure : il vous connecte et vous fait choisir votre mot de passe. Lien expiré ? <a href="${appUrl("/mot-de-passe-oublie")}">${appUrl("/mot-de-passe-oublie")}</a></p>`,
      { label: "Ouvrir Acco", href: direct }),
  });
  revalidatePath("/crm/equipe");
  return res.sent ? { ok: `Compte ${ROLE_LABEL[role]} créé, lien de connexion envoyé à ${email}.` } : { ok: `Compte créé. L’email n’est pas parti (${"error" in res && res.error ? res.error : "clé Resend absente"}) : la personne peut passer par « Mot de passe oublié ».` };
}

/** Change le rôle d'un membre (Direction seulement ; on ne se rétrograde pas soi-même). */
export async function setTeamRole(id: string, role: Role) {
  const me = await requireAdmin();
  if (!EQUIPE.includes(role) || id === me.id) return;
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/crm/equipe");
}

/** Retire l'accès d'un membre (ses prospects et clients restent, sans responsable). */
export async function removeTeamMember(id: string) {
  const me = await requireAdmin();
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role === "CLIENT" || id === me.id) return;
  await prisma.$transaction([
    prisma.prospect.updateMany({ where: { commercialId: id }, data: { commercialId: null } }),
    prisma.client.updateMany({ where: { commercialId: id }, data: { commercialId: null } }),
    prisma.client.updateMany({ where: { developpeurId: id }, data: { developpeurId: null } }),
    prisma.user.update({ where: { id }, data: { role: "CLIENT" } }),
  ]);
  await createSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "876000h" }).catch(() => null);
  revalidatePath("/crm/equipe");
}
