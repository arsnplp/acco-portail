"use server";

import { revalidatePath } from "next/cache";
import type { Mode, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDroit } from "@/lib/auth";
import { ensureAuthUser } from "@/lib/invitations";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, layout, appUrl } from "@/lib/email";
import { EQUIPE, MODE_LABEL, ROLE_LABEL, homeFor } from "@/lib/roles";
import { DROITS, PRESETS, type Droit, type Preset } from "@/lib/permissions";
import { logActivite } from "@/lib/activite";
import { teamName } from "@/lib/crm";

export type TeamState = { error?: string; ok?: string };

const ACCES: Record<Exclude<Role, "CLIENT">, string> = {
  ADMIN: "à tout l’outil Acco : Pilotage, Prospection et Suivi",
  COMMERCIAL: "à la Prospection (prospects, relances, rendez-vous) et au Suivi des clients",
  DEV: "au Suivi : les clients, leurs sites et la production",
  EXPERT: "au Suivi : les projets qui vous sont confiés",
  SPECIALISTE: "au Suivi : les projets qui vous sont confiés",
};
const DROITS_VALIDES = Object.keys(DROITS) as Droit[];

/** Journal d'audit des changements de rôle et de droits (section 20.2) : qui, quoi, pour qui. */
async function journalEquipe(meId: string, cible: { id: string; firstName: string | null; email: string }, texte: string) {
  await logActivite({ kind: "equipe", texte: `${teamName(cible)} : ${texte}`, href: "/crm/equipe", userId: meId });
}

/** Crée le compte d'un membre de l'équipe avec son rôle et lui envoie son lien de connexion. */
export async function addTeamMember(_prev: TeamState, f: FormData): Promise<TeamState> {
  const admin = await requireDroit("equipe");
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
  await journalEquipe(admin.id, { id, firstName, email }, `compte créé avec le rôle ${ROLE_LABEL[role]}`);

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

/** Change le rôle d'un membre (on ne se rétrograde pas soi-même). */
export async function setTeamRole(id: string, role: Role) {
  const me = await requireDroit("equipe");
  if (!EQUIPE.includes(role) || id === me.id) return;
  const u = await prisma.user.update({ where: { id }, data: { role } });
  if (role !== "ADMIN" && u.modeDefaut === "ADMIN") await prisma.user.update({ where: { id }, data: { modeDefaut: null } });
  await journalEquipe(me.id, u, `rôle changé en ${ROLE_LABEL[role]}`);
  revalidatePath("/crm/equipe");
}

/** Mode de démarrage (section 2.2) : une vue, pas un droit. Le mode Admin est réservé aux administrateurs. */
export async function setTeamMode(id: string, mode: Mode | "") {
  const me = await requireDroit("equipe");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role === "CLIENT") return;
  if (mode === "ADMIN" && u.role !== "ADMIN") return;
  await prisma.user.update({ where: { id }, data: { modeDefaut: mode || null } });
  await journalEquipe(me.id, u, mode ? `démarre en mode ${MODE_LABEL[mode]}` : "mode de démarrage retiré");
  revalidatePath("/crm/equipe");
}

/** Droits unitaires (section 20.1). Journalise le détail de chaque ajout et retrait. */
export async function setTeamDroits(id: string, droits: string[]) {
  const me = await requireDroit("equipe");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role === "CLIENT") return;
  const voulus = droits.filter((d): d is Droit => DROITS_VALIDES.includes(d as Droit));
  const ajoutes = voulus.filter((d) => !u.droits.includes(d));
  const retires = u.droits.filter((d) => !voulus.includes(d as Droit));
  if (ajoutes.length === 0 && retires.length === 0) return;
  await prisma.user.update({ where: { id }, data: { droits: voulus } });
  const texte = [ajoutes.length ? `droits ajoutés : ${ajoutes.map((d) => DROITS[d]).join(", ")}` : "", retires.length ? `droits retirés : ${retires.map((d) => DROITS[d as Droit] ?? d).join(", ")}` : ""].filter(Boolean).join(" ; ");
  await journalEquipe(me.id, u, texte);
  revalidatePath("/crm/equipe");
}

/** Applique en un clic les réglages par défaut de Bilel, Lucas ou Arsène (rôle, mode, droits). */
export async function appliquerPreset(id: string, preset: Preset) {
  const me = await requireDroit("equipe");
  const p = PRESETS[preset];
  const u = await prisma.user.findUnique({ where: { id } });
  if (!p || !u || u.role === "CLIENT") return;
  if (id === me.id && p.role !== me.role) return; // on ne change pas son propre rôle
  await prisma.user.update({ where: { id }, data: { role: p.role, modeDefaut: p.modeDefaut, droits: [...p.droits] } });
  await journalEquipe(me.id, u, `réglages par défaut appliqués (${p.label})`);
  revalidatePath("/crm/equipe");
}

/** Retire l'accès d'un membre (ses prospects et clients restent, sans responsable). */
export async function removeTeamMember(id: string) {
  const me = await requireDroit("equipe");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role === "CLIENT" || id === me.id) return;
  await prisma.$transaction([
    prisma.prospect.updateMany({ where: { commercialId: id }, data: { commercialId: null } }),
    prisma.client.updateMany({ where: { commercialId: id }, data: { commercialId: null } }),
    prisma.client.updateMany({ where: { developpeurId: id }, data: { developpeurId: null } }),
    prisma.delegation.deleteMany({ where: { OR: [{ deId: id }, { versId: id }], fin: { gte: new Date() } } }),
    prisma.user.update({ where: { id }, data: { role: "CLIENT", droits: [], modeDefaut: null } }),
  ]);
  await createSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "876000h" }).catch(() => null);
  await journalEquipe(me.id, u, "accès retiré");
  revalidatePath("/crm/equipe");
}

/** Délégation temporaire d'un portefeuille (section 3.3) : datée, retour automatique au référent à la fin. */
export async function creerDelegation(_prev: TeamState, f: FormData): Promise<TeamState> {
  const me = await requireDroit("attribuer");
  const deId = String(f.get("deId") ?? "");
  const versId = String(f.get("versId") ?? "");
  const clientId = String(f.get("clientId") ?? "") || null;
  const debut = new Date(String(f.get("debut") ?? ""));
  const fin = new Date(String(f.get("fin") ?? ""));
  const motif = String(f.get("motif") ?? "").trim() || null;
  if (!deId || !versId || deId === versId) return { error: "Choisissez deux personnes différentes." };
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || fin < debut) return { error: "Les dates ne sont pas valides." };
  const [de, vers] = await Promise.all([prisma.user.findUnique({ where: { id: deId } }), prisma.user.findUnique({ where: { id: versId } })]);
  if (!de || !vers || de.role === "CLIENT" || vers.role === "CLIENT") return { error: "Membres introuvables." };
  fin.setHours(23, 59, 59, 999);
  await prisma.delegation.create({ data: { deId, versId, clientId, debut, fin, motif, createdById: me.id } });
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }) : null;
  await logActivite({ kind: "delegation", texte: `Délégation : ${teamName(de)} → ${teamName(vers)}${client ? ` (${client.name})` : " (tout le portefeuille)"} jusqu’au ${fin.toLocaleDateString("fr-FR")}${motif ? ` · ${motif}` : ""}`, href: "/crm/equipe", userId: me.id, clientId });
  revalidatePath("/crm/equipe");
  return { ok: `Délégation enregistrée jusqu’au ${fin.toLocaleDateString("fr-FR")} : ${teamName(vers)} agit pour ${teamName(de)}.` };
}

/** Met fin à une délégation avant son terme (le référent reprend la main immédiatement). */
export async function terminerDelegation(id: string) {
  const me = await requireDroit("attribuer");
  const d = await prisma.delegation.findUnique({ where: { id }, include: { de: true, vers: true } });
  if (!d) return;
  await prisma.delegation.update({ where: { id }, data: { fin: new Date(Date.now() - 1000) } });
  await logActivite({ kind: "delegation", texte: `Délégation terminée : ${teamName(d.de)} → ${teamName(d.vers)}`, href: "/crm/equipe", userId: me.id, clientId: d.clientId });
  revalidatePath("/crm/equipe");
}
