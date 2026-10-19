"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { disconnectGoogle } from "@/lib/google-oauth";

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  for (const key of ["google_review_url", "referral_reward_label"]) {
    const value = String(formData.get(key) ?? "").trim();
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  revalidatePath("/admin/parametres");
  revalidatePath("/compte");
}

export async function disconnectGoogleAction() {
  await requireAdmin();
  await disconnectGoogle();
  revalidatePath("/admin/parametres");
  revalidatePath("/admin/sites", "layout");
}

export async function saveServices(formData: FormData) {
  await requireAdmin();
  const { SECRETS, FEATURES } = await import("@/lib/settings");
  for (const key of Object.keys(SECRETS)) {
    const raw = formData.get(key);
    if (raw === null) continue;
    const value = String(raw).trim();
    if (formData.get(`${key}__clear`) === "on") { await prisma.setting.deleteMany({ where: { key } }); continue; }
    if (value) await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  for (const key of Object.keys(FEATURES)) {
    const value = formData.get(key) === "on" ? "true" : "false";
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  revalidatePath("/admin", "layout");
}
