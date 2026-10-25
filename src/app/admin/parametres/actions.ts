"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireGestionnaire } from "@/lib/auth";
import { disconnectGoogle } from "@/lib/google-oauth";

export async function saveSettings(formData: FormData) {
  await requireGestionnaire();
  for (const key of ["google_review_url", "referral_reward_label"]) {
    const value = String(formData.get(key) ?? "").trim();
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  revalidatePath("/admin/parametres");
  revalidatePath("/compte");
}

export async function disconnectGoogleAction() {
  await requireGestionnaire();
  await disconnectGoogle();
  revalidatePath("/admin/parametres");
  revalidatePath("/admin/sites", "layout");
}

/** Mes notifications (équipe) : push sur cet appareil et choix des événements. */
export async function saveAdminNotifPrefs(formData: FormData) {
  const admin = await requireAdmin();
  const on = (k: string) => formData.get(k) === "on";
  const data = { pushEnabled: on("pushEnabled"), changes: on("changes"), messages: on("messages"), referrals: on("referrals"), documents: on("documents") };
  await prisma.notificationPreference.upsert({ where: { userId: admin.id }, create: { userId: admin.id, ...data }, update: data });
  revalidatePath("/admin/parametres");
}

/** Envoie un push de test sur tous les appareils où l'admin a activé les notifications. */
export async function sendTestPush(): Promise<{ ok: boolean; devices: number }> {
  const admin = await requireAdmin();
  const devices = await prisma.pushSubscription.count({ where: { userId: admin.id } });
  const { sendPushToUser } = await import("@/lib/push");
  await sendPushToUser(admin.id, { title: "Test Acco", body: "Les notifications fonctionnent sur cet appareil.", url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/parametres`, tag: "test" });
  return { ok: devices > 0, devices };
}

export type ServicesState = { errors?: Record<string, string>; infos?: Record<string, string>; ok?: boolean };

/** Enregistre les clés après vérification auprès de chaque service ; n'active une fonction que si ses clés sont valides. */
export async function saveServices(_prev: ServicesState, formData: FormData): Promise<ServicesState> {
  await requireGestionnaire();
  const { SECRETS, FEATURES, getSecret } = await import("@/lib/settings");
  const { verifySecret } = await import("@/lib/verify-keys");
  const errors: Record<string, string> = {}, infos: Record<string, string> = {};

  for (const key of Object.keys(SECRETS) as Array<keyof typeof SECRETS>) {
    if (formData.get(`${key}__clear`) === "on") { await prisma.setting.deleteMany({ where: { key } }); infos[key] = "Clé effacée."; continue; }
    const value = String(formData.get(key) ?? "").trim();
    if (!value) continue;
    const v = await verifySecret(key, value);
    if (!v.ok) { errors[key] = v.error; continue; }
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    infos[key] = v.detail ?? "Clé enregistrée.";
  }

  for (const feature of Object.keys(FEATURES) as Array<keyof typeof FEATURES>) {
    const wanted = formData.get(feature) === "on";
    let allowed = wanted;
    if (wanted) {
      for (const k of FEATURES[feature].needs) {
        if (!(await getSecret(k)) || errors[k]) { allowed = false; errors[feature] = "Impossible d’activer : clé manquante ou invalide."; }
      }
      if (feature === "feature_business_api" && allowed) {
        const { connectedGoogleClient } = await import("@/lib/google-oauth");
        const client = await connectedGoogleClient();
        if (!client) { allowed = false; errors[feature] = "Connectez d’abord le compte Google."; }
        else {
          try { await client.request({ url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts" }); }
          catch (e) { allowed = false; const st = (e as { response?: { status?: number } }).response?.status; errors[feature] = st === 403 ? "Google n’a pas encore validé l’accès de ce projet à l’API Business Profile." : `Google répond ${st ?? "une erreur"} : API non activée ou accès non validé.`; }
        }
      }
    }
    await prisma.setting.upsert({ where: { key: feature }, create: { key: feature, value: String(allowed) }, update: { value: String(allowed) } });
  }
  revalidatePath("/admin", "layout");
  return { errors, infos, ok: Object.keys(errors).length === 0 };
}
