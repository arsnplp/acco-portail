/**
 * Envoi d'emails aux clients par l'API Gmail, depuis la boîte Google Workspace du collaborateur (section 00.4).
 * Un email par destinataire, variables remplacées, aucun suivi d'ouverture. Pas de prestataire tiers.
 */
import { prisma } from "@/lib/prisma";
import { userGoogleClient, connectedGoogleClient } from "@/lib/google-oauth";
import { connecteurActif, journal } from "@/lib/connecteurs";

export type Variables = Record<string, string | null | undefined>;

/** Remplace {{prenom}}, {{societe}}, {{site}}, {{commercial}}… (clé inconnue → vide). */
export function remplacerVariables(texte: string, vars: Variables) {
  return texte.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}
const b64url = (s: string) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

function message(from: string, to: string, subject: string, html: string, text?: string) {
  const boundary = `acco-${Math.random().toString(36).slice(2)}`;
  return [
    `From: ${from}`, `To: ${to}`, `Subject: ${encodeHeader(subject)}`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).toString("base64"), "",
    `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(html).toString("base64"), "",
    `--${boundary}--`,
  ].join("\r\n");
}

/**
 * Envoie un email depuis la boîte de `userId` (compte Google personnel connecté) ; à défaut depuis la boîte de l'agence.
 * Renvoie l'id Gmail du message, ou une erreur lisible. Ne lève jamais.
 */
export async function envoyerParGmail(opts: { userId?: string | null; to: string; subject: string; html: string; text?: string }): Promise<{ ok: true; id: string; de: string } | { ok: false; error: string }> {
  if (!(await connecteurActif("gmail"))) return { ok: false, error: "Le connecteur Gmail est désactivé (Administration → IA et intégrations)." };
  let client = opts.userId ? await userGoogleClient(opts.userId) : null;
  let de: string | null = null;
  if (client && opts.userId) de = (await prisma.user.findUnique({ where: { id: opts.userId }, select: { googleEmail: true, firstName: true, lastName: true } }).then((u) => (u?.googleEmail ? `${[u.firstName, u.lastName].filter(Boolean).join(" ") || "Acco"} <${u.googleEmail}>` : null))) ?? null;
  if (!client || !de) {
    client = await connectedGoogleClient();
    const email = (await prisma.setting.findUnique({ where: { key: "google_account_email" } }))?.value;
    if (!client || !email) return { ok: false, error: "Aucune boîte Gmail connectée : connectez votre compte Google dans Paramètres." };
    de = `Acco <${email}>`;
  }
  try {
    const raw = b64url(message(de, opts.to, opts.subject, opts.html, opts.text));
    const res = await client.request<{ id: string }>({ url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", method: "POST", data: { raw } });
    return { ok: true, id: res.data.id, de };
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
    const msg = err.response?.data?.error?.message ?? err.message ?? "";
    const lisible = /insufficient|scope/i.test(msg) || err.response?.status === 403 ? "Permission d’envoi Gmail manquante : déconnectez puis reconnectez votre compte Google." : /invalid_grant/i.test(msg) ? "Connexion Google expirée : reconnectez votre compte." : `Gmail : ${msg}`;
    await journal("gmail", "erreur", lisible);
    return { ok: false, error: lisible };
  }
}
