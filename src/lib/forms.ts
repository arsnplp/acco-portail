import { featureEnabled, getSecret } from "@/lib/settings";

/** Vérifie le jeton Cloudflare Turnstile. Fonction désactivée ou sans clé : on accepte. */
export async function verifyTurnstile(token: string | null, ip?: string | null) {
  if (!(await featureEnabled("feature_turnstile"))) return { ok: true as const, skipped: true as const };
  const secret = (await getSecret("turnstile_secret_key"))!;
  if (!token) return { ok: false as const, reason: "captcha manquant" };
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const json = (await res.json()) as { success: boolean };
    return json.success ? { ok: true as const, skipped: false as const } : { ok: false as const, reason: "captcha refusé" };
  } catch {
    return { ok: false as const, reason: "captcha indisponible" };
  }
}

/** Anti-rafale en mémoire : max N envois par clé sur une fenêtre glissante. */
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max = 5, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t > windowMs)) hits.delete(k);
  return list.length <= max;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
