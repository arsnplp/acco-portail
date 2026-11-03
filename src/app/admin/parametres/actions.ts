"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isGestionnaire, requireGestionnaire, requireTeam } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FONCTION_LABEL, type FonctionIA } from "@/lib/ia";
import { disconnectGoogle, disconnectUserGoogle } from "@/lib/google-oauth";

export async function saveSettings(formData: FormData) {
  await requireGestionnaire();
  for (const key of ["google_review_url", "referral_reward_label"]) {
    const value = String(formData.get(key) ?? "").trim();
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  revalidatePath("/admin/parametres");
  revalidatePath("/compte");
}

/** IA et intégrations (00.6 / 00.7) : interrupteurs IA par fonction, plafond mensuel, connecteurs. Réservé au droit ia_admin. */
export async function saveIaIntegrations(formData: FormData) {
  const me = await requireTeam();
  if (!can(me, "ia_admin")) return;
  const set = (key: string, value: string) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await set("feature_ai", formData.get("feature_ai") === "on" ? "true" : "false");
  for (const f of Object.keys(FONCTION_LABEL) as FonctionIA[]) await set(`ia_${f}`, formData.get(`ia_${f}`) === "on" ? "true" : "false");
  if (isGestionnaire(me) && formData.has("plafond_euros")) {
    const plafond = Math.round(Number(String(formData.get("plafond_euros") ?? "20").replace(",", ".")) * 100);
    await set("ia_plafond_cents", String(Number.isFinite(plafond) && plafond >= 0 ? plafond : 2000));
  }
  for (const c of ["feature_gmail", "feature_calendar", "feature_aircall", "feature_search_console", "feature_business_api"]) await set(c, formData.get(c) === "on" ? "true" : "false");
  await set("feature_financier", "false"); // bientôt disponible : jamais activé en V1
  const { logActivite } = await import("@/lib/activite");
  await logActivite({ kind: "reglages", texte: "Réglages IA et intégrations modifiés", href: "/admin/parametres", userId: me.id });
  revalidatePath("/admin", "layout");
}

export async function disconnectGoogleAction() {
  await requireGestionnaire();
  await disconnectGoogle();
  revalidatePath("/admin/parametres");
  revalidatePath("/admin/sites", "layout");
}

/** Déconnecter mon compte Google personnel (emails du CRM). */
export async function disconnectMyGoogleAction() {
  const me = await requireTeam();
  await disconnectUserGoogle(me.id);
  revalidatePath("/admin/parametres");
  revalidatePath("/crm/parametres");
}

/** Pousse mes RDV et échéances dans mon Google Agenda maintenant. */
export async function syncMyAgendaAction(): Promise<{ ok: boolean; rdv: number; echeances: number; error?: string }> {
  const me = await requireTeam();
  const { syncAgendaForUser } = await import("@/lib/agenda");
  return syncAgendaForUser(me.id);
}

/** Mes notifications (équipe) : push sur cet appareil et choix des événements. */
export async function saveAdminNotifPrefs(formData: FormData) {
  const admin = await requireTeam();
  const on = (k: string) => formData.get(k) === "on";
  const data = { pushEnabled: on("pushEnabled"), changes: on("changes"), messages: on("messages"), referrals: on("referrals"), documents: on("documents"), offers: on("offers") };
  await prisma.notificationPreference.upsert({ where: { userId: admin.id }, create: { userId: admin.id, ...data }, update: data });
  revalidatePath("/admin/parametres");
}

/** Envoie un push de test sur tous les appareils où l'admin a activé les notifications. */
export async function sendTestPush(): Promise<{ ok: boolean; devices: number }> {
  const admin = await requireTeam();
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
  const typed = Object.fromEntries((Object.keys(SECRETS) as Array<keyof typeof SECRETS>).map((k) => [k, String(formData.get(k) ?? "").trim()])) as Partial<Record<keyof typeof SECRETS, string>>;

  for (const key of Object.keys(SECRETS) as Array<keyof typeof SECRETS>) {
    if (formData.get(`${key}__clear`) === "on") { await prisma.setting.deleteMany({ where: { key } }); infos[key] = "Clé effacée."; continue; }
    const value = String(formData.get(key) ?? "").trim();
    if (!value) continue;
    const v = await verifySecret(key, value, typed);
    if (!v.ok) { errors[key] = v.error; continue; }
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    infos[key] = v.detail ?? "Clé enregistrée.";
  }

  // Seuls les interrupteurs présents dans ce formulaire sont enregistrés ; les autres (IA, connecteurs) vivent dans « IA et intégrations ».
  for (const feature of (Object.keys(FEATURES) as Array<keyof typeof FEATURES>).filter((f) => formData.has(`${f}_present`))) {
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
