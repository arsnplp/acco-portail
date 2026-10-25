"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ensureAuthUser } from "@/lib/invitations";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, layout, appUrl } from "@/lib/email";

export type TeamState = { error?: string; ok?: string };

/** Crée le compte d'un alternant / commercial (accès à l'espace Commercial seulement) et lui envoie son lien de connexion. */
export async function addTeamMember(_prev: TeamState, f: FormData): Promise<TeamState> {
  const admin = await requireAdmin();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const firstName = String(f.get("firstName") ?? "").trim() || null;
  const lastName = String(f.get("lastName") ?? "").trim() || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Adresse email invalide." };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.role === "ADMIN") return { error: "Cette personne est déjà admin : elle a déjà accès à l’espace Commercial." };
  if (existing?.role === "CLIENT") return { error: "Cette adresse est un compte client. Utilisez une autre adresse pour l’équipe." };

  let id: string;
  try { id = await ensureAuthUser(email, { first_name: firstName ?? undefined, last_name: lastName ?? undefined, role: "COMMERCIAL" }); }
  catch (e) { return { error: (e as Error).message }; }
  await prisma.user.upsert({ where: { id }, create: { id, email, firstName, lastName, role: "COMMERCIAL" }, update: { role: "COMMERCIAL", firstName: firstName ?? undefined, lastName: lastName ?? undefined } });

  const sb = createSupabaseAdmin();
  const { data } = await sb.auth.admin.generateLink({ type: "magiclink", email });
  const direct = data?.properties?.hashed_token ? appUrl(`/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`) : appUrl("/connexion");
  const res = await sendEmail({
    to: email,
    subject: "Votre accès à l’espace Commercial Acco",
    html: layout(`Bienvenue${firstName ? ` ${firstName}` : ""}`, `
      <p>${admin.firstName ?? "L’équipe Acco"} vous donne accès à l’espace Commercial d’Acco : vos prospects, vos relances du jour et vos rendez-vous.</p>
      <p style="font-size:13px;color:#71717a">Le bouton est valable 1 heure : il vous connecte et vous fait choisir votre mot de passe. Lien expiré ? <a href="${appUrl("/mot-de-passe-oublie")}">${appUrl("/mot-de-passe-oublie")}</a></p>`,
      { label: "Ouvrir l’espace Commercial", href: direct }),
  });
  revalidatePath("/crm/equipe");
  return res.sent ? { ok: `Compte créé, lien de connexion envoyé à ${email}.` } : { ok: `Compte créé. L’email n’est pas parti (${"error" in res && res.error ? res.error : "clé Resend absente"}) : la personne peut passer par « Mot de passe oublié ».` };
}

/** Retire l'accès d'un commercial (ses prospects restent, sans commercial). */
export async function removeTeamMember(id: string) {
  await requireAdmin();
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role !== "COMMERCIAL") return;
  await prisma.$transaction([
    prisma.prospect.updateMany({ where: { commercialId: id }, data: { commercialId: null } }),
    prisma.user.update({ where: { id }, data: { role: "CLIENT" } }),
  ]);
  await createSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "876000h" }).catch(() => null);
  revalidatePath("/crm/equipe");
}
