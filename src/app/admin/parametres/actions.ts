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
