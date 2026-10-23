import type { SecretKey } from "@/lib/settings";

export type Verification = { ok: true; detail?: string } | { ok: false; error: string };

/** Vérifie une clé auprès du service concerné avant de l'enregistrer. */
export async function verifySecret(key: SecretKey, value: string, extra?: Partial<Record<SecretKey, string>>): Promise<Verification> {
  try {
    switch (key) {
      case "anthropic_api_key":
      case "claude_code_api_key": {
        const res = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": value, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(10_000) });
        if (res.status === 401 || res.status === 403) return { ok: false, error: "Clé Anthropic refusée." };
        if (!res.ok) {
          const msg = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? "";
          if (/credit balance/i.test(msg)) return { ok: false, error: "Clé valide mais plus de crédit : console.anthropic.com → Billing → ajouter du crédit." };
          return { ok: false, error: `Anthropic répond ${res.status}${msg ? ` : ${msg}` : "."}` };
        }
        return { ok: true, detail: "Clé Anthropic valide." };
      }
      case "resend_api_key": {
        const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${value}` }, signal: AbortSignal.timeout(10_000) });
        if (res.status === 400 || res.status === 401 || res.status === 403) return { ok: false, error: "Clé Resend refusée." };
        if (!res.ok) return { ok: false, error: `Resend répond ${res.status}.` };
        const json = (await res.json()) as { data?: { name: string; status: string }[] };
        const verified = (json.data ?? []).filter((d) => d.status === "verified").map((d) => d.name);
        return verified.length ? { ok: true, detail: `Domaines vérifiés : ${verified.join(", ")}.` } : { ok: false, error: "Clé valide mais aucun domaine vérifié sur ce compte Resend." };
      }
      case "turnstile_secret_key": {
        const body = new URLSearchParams({ secret: value, response: "test" });
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(10_000) });
        const json = (await res.json()) as { success: boolean; "error-codes"?: string[] };
        const codes = json["error-codes"] ?? [];
        if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) return { ok: false, error: "Secret key Turnstile refusée par Cloudflare." };
        return { ok: true, detail: "Secret key Turnstile reconnue." };
      }
      case "turnstile_site_key": {
        const site = value.trim();
        if (!/^0x[0-9A-Za-z_-]{10,}$/.test(site) && !/^[0-9A-Za-z_-]{20,}$/.test(site)) return { ok: false, error: "Format de site key Turnstile inattendu (elle commence en général par 0x)." };
        if (extra?.turnstile_secret_key === undefined) return { ok: true };
        return { ok: true, detail: "Site key enregistrée." };
      }
    }
  } catch (e) {
    return { ok: false, error: `Vérification impossible : ${(e as Error).message}` };
  }
}
