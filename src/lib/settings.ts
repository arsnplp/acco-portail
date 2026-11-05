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

/**
 * Interrupteurs. Politique par défaut (section 00.6 / 00.7 du prompt maître) : tout ce qui consomme des crédits IA est
 * DÉSACTIVÉ tant qu'il n'a pas été coché ; les connecteurs d'outils déjà payés sont actifs quand leurs clés existent.
 */
export const FEATURES = {
  feature_ai: { label: "IA (Claude) : fonctions sur clic, plafond mensuel, compteur", needs: ["anthropic_api_key"] as SecretKey[], defaut: false },
  feature_claude_code: { label: "Claude Code sur les demandes de modification (worker du Mac)", needs: ["claude_code_api_key"] as SecretKey[], defaut: false },
  feature_turnstile: { label: "Anti-spam Cloudflare Turnstile sur les formulaires", needs: ["turnstile_site_key", "turnstile_secret_key"] as SecretKey[], defaut: true },
  feature_business_api: { label: "Vrais avis Google (API Business Profile validée)", needs: [] as SecretKey[], defaut: false },
  feature_aircall: { label: "Aircall : appels, enregistrements et analyses IA dans l’historique, click-to-call", needs: ["aircall_api_id", "aircall_api_token"] as SecretKey[], defaut: true },
  feature_gmail: { label: "Gmail : lecture des échanges avec les clients et envoi des emails depuis l’app", needs: [] as SecretKey[], defaut: true },
  feature_calendar: { label: "Google Agenda : RDV et échéances dans les agendas des membres", needs: [] as SecretKey[], defaut: true },
  feature_search_console: { label: "Google Search Console : chiffres SEO du portail (tâche quotidienne)", needs: [] as SecretKey[], defaut: true },
  feature_financier: { label: "Connecteur financier (bientôt disponible)", needs: [] as SecretKey[], defaut: false },
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
  const on = all.has(key) ? all.get(key) === "true" : (envDefault ?? FEATURES[key].defaut);
  if (!on) return false;
  if (key === "feature_financier") return false; // pas de connecteur financier en V1 (00.10)
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
  for (const k of Object.keys(FEATURES) as FeatureKey[]) out[k] = all.has(k) ? all.get(k) === "true" : k === "feature_business_api" ? process.env.GOOGLE_BUSINESS_API_ENABLED === "true" : FEATURES[k].defaut;
  return out;
}
