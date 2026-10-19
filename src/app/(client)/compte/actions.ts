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
    contactRequests: on("contactRequests"), reviews: on("reviews"), changes: on("changes"), recaps: on("recaps"), messages: on("messages"), offers: on("offers"),
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
