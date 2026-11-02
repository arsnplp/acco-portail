"use server";

import { headers } from "next/headers";
import { accepterContrat, envoyerCode, refuserContrat } from "@/lib/contrats";

export type AccepterState = { error?: string; codeEnvoye?: boolean; signe?: boolean; refuse?: boolean };

async function origine() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"), ua: h.get("user-agent") };
}

/** Étape 1 : envoi du code à usage unique à l'adresse du signataire. */
export async function demanderCode(token: string, _prev: AccepterState, fd: FormData): Promise<AccepterState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Adresse email invalide." };
  const r = await envoyerCode(token, email);
  return r.ok ? { codeEnvoye: true } : { error: r.error };
}

/** Étape 2 : nom, case cochée, code vérifié → signature, certificat, conversion. */
export async function accepter(token: string, _prev: AccepterState, fd: FormData): Promise<AccepterState> {
  const { ip, ua } = await origine();
  const r = await accepterContrat(token, { nom: String(fd.get("nom") ?? ""), email: String(fd.get("email") ?? ""), code: String(fd.get("code") ?? ""), accepte: fd.get("accepte") === "on", ip: ip ?? null, ua });
  return r.ok ? { signe: true } : { error: r.error, codeEnvoye: true };
}

export async function refuser(token: string, _prev: AccepterState, fd: FormData): Promise<AccepterState> {
  const ok = await refuserContrat(token, String(fd.get("motif") ?? "").trim() || null);
  return ok ? { refuse: true } : { error: "Ce contrat n’est plus ouvert." };
}
