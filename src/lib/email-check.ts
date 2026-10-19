import { promises as dns } from "node:dns";
import { z } from "zod";

/** Un vrai email : format valide ET domaine capable de recevoir du courrier (enregistrement MX). */
export async function checkRealEmail(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().email().safeParse(email).success) return { ok: false, error: "Adresse email invalide." };
  const domain = email.split("@")[1]?.toLowerCase();
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx.length) return { ok: false, error: `Le domaine ${domain} ne reçoit pas d’emails.` };
    return { ok: true };
  } catch {
    try { await dns.resolve4(domain); return { ok: true }; } catch { return { ok: false, error: `Le domaine ${domain} n’existe pas.` }; }
  }
}
