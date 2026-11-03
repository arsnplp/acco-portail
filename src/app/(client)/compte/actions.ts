"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientContext, CLIENT_COOKIE } from "@/lib/auth";

export type ActionState = { error?: string; ok?: boolean };

export async function updateCompany(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { client, membership } = await requireClientContext();
  if (membership.role !== "OWNER") return { error: "Seul le gérant peut modifier ces informations." };
  const d = Object.fromEntries(formData) as Record<string, string>;
  if (!d.name?.trim()) return { error: "Le nom est requis." };
  await prisma.client.update({ where: { id: client.id }, data: { name: d.name.trim(), address: d.address?.trim() || null, phone: d.phone?.trim() || null, email: d.email?.trim() || null } });
  revalidatePath("/compte");
  return { ok: true };
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireClientContext();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName) return { error: "Votre prénom est requis." };
  await prisma.user.update({ where: { id: user.id }, data: { firstName, lastName: lastName || null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateNotificationPrefs(formData: FormData) {
  const { user } = await requireClientContext();
  const on = (k: string) => formData.get(k) === "on";
  const data = {
    pushEnabled: on("pushEnabled"), emailEnabled: on("emailEnabled"),
    contactRequests: on("contactRequests"), reviews: on("reviews"), changes: on("changes"), recaps: on("recaps"), messages: on("messages"), offers: on("offers"), documents: on("documents"),
  };
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  revalidatePath("/compte");
}

export async function switchClient(clientId: string) {
  const { user } = await requireClientContext();
  if (!user.memberships.some((m) => m.clientId === clientId)) return;
  (await cookies()).set(CLIENT_COOKIE, clientId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/");
}

/** Logo déposé par le client (00.1), même traitement que côté équipe. */
export async function uploadLogoClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { client, membership } = await requireClientContext();
  if (membership.role !== "OWNER") return { error: "Réservé au gérant du compte." };
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  try { const { enregistrerLogo } = await import("@/lib/logo"); await enregistrerLogo(client.id, file); }
  catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/compte");
  return {};
}
/** Préférence « ne pas recevoir de messages commerciaux » (00.4) : s'applique aux contacts portant l'email de l'utilisateur. */
export async function setOptOutCommercial(formData: FormData) {
  const { user, client } = await requireClientContext();
  const optOut = formData.get("optOut") === "on";
  await prisma.prospectContact.updateMany({ where: { email: { equals: user.email, mode: "insensitive" }, OR: [{ clientId: client.id }, { prospect: { clientId: client.id } }] }, data: { optOutCommercial: optOut } });
  revalidatePath("/compte");
}
