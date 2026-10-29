import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Clés et interrupteurs gérés depuis Paramètres (table Setting), avec repli sur .env.
 * Les secrets ne sortent jamais de la base autrement que masqués.
 */
export const SECRETS = {
  anthropic_api_key: "ANTHROPIC_API_KEY",
  claude_code_api_key: "CLAUDE_CODE_API_KEY",
  turnstile_site_key: "TURNSTILE_SITE_KEY",
  turnstile_secret_key: "TURNSTILE_SECRET_KEY",
  resend_api_key: "RESEND_API_KEY",
  aircall_api_id: "AIRCALL_API_ID",
  aircall_api_token: "AIRCALL_API_TOKEN",
} as const;
export type SecretKey = keyof typeof SECRETS;

export const FEATURES = {
  feature_ai: { label: "Résumés et réponses rédigés par Claude", needs: ["anthropic_api_key"] as SecretKey[] },
  feature_claude_code: { label: "Claude Code sur les demandes de modification", needs: ["claude_code_api_key"] as SecretKey[] },
  feature_turnstile: { label: "Anti-spam Cloudflare Turnstile sur les formulaires", needs: ["turnstile_site_key", "turnstile_secret_key"] as SecretKey[] },
  feature_business_api: { label: "Vrais avis Google (API Business Profile validée)", needs: [] as SecretKey[] },
  feature_aircall: { label: "Aircall : appels, enregistrements et analyses IA dans l’historique des fiches", needs: ["aircall_api_id", "aircall_api_token"] as SecretKey[] },
} as const;
export type FeatureKey = keyof typeof FEATURES;

const loadAll = cache(async () => {
  const rows = await prisma.setting.findMany();
  return new Map(rows.map((r) => [r.key, r.value]));
});

export async function getSecret(key: SecretKey): Promise<string | null> {
  const all = await loadAll();
  return all.get(key)?.trim() || process.env[SECRETS[key]]?.trim() || null;
}

/** Fonction active : interrupteur coché ET clés nécessaires présentes. */
export async function featureEnabled(key: FeatureKey): Promise<boolean> {
  const all = await loadAll();
  const envDefault = key === "feature_business_api" ? process.env.GOOGLE_BUSINESS_API_ENABLED === "true" : undefined;
  const on = all.has(key) ? all.get(key) === "true" : (envDefault ?? true);
  if (!on) return false;
  for (const k of FEATURES[key].needs) if (!(await getSecret(k))) return false;
  return true;
}

export function maskSecret(v: string | null) {
  if (!v) return null;
  return v.length <= 8 ? "••••" : `${v.slice(0, 4)}…${v.slice(-4)}`;
}

/** État affiché dans Paramètres : d'où vient chaque clé, masquée. */
export async function secretsStatus() {
  const all = await loadAll();
  const out: Record<SecretKey, { masked: string | null; source: "base" | "env" | null }> = {} as never;
  for (const k of Object.keys(SECRETS) as SecretKey[]) {
    const db = all.get(k)?.trim();
    const env = process.env[SECRETS[k]]?.trim();
    out[k] = db ? { masked: maskSecret(db), source: "base" } : env ? { masked: maskSecret(env), source: "env" } : { masked: null, source: null };
  }
  return out;
}

export async function featureToggles() {
  const all = await loadAll();
  const out: Record<FeatureKey, boolean> = {} as never;
  for (const k of Object.keys(FEATURES) as FeatureKey[]) out[k] = all.has(k) ? all.get(k) === "true" : k === "feature_business_api" ? process.env.GOOGLE_BUSINESS_API_ENABLED === "true" : true;
  return out;
}
