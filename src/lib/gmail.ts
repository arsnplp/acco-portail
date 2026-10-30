/**
 * Emails échangés avec un prospect (envoyés et reçus), lus en lecture seule dans les boîtes Gmail connectées :
 * celle de l'agence (Admin → Paramètres, gestionnaire) et celle de chaque membre de l'équipe qui a connecté
 * son propre compte Google (Paramètres → Mon compte Google). Chaque mail devient un échange « Mail » (origine gmail).
 */
import type { OAuth2Client } from "google-auth-library";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { connectedGoogleClient, oauthConfigured, oauthClient } from "@/lib/google-oauth";
import { isGmailMeta, type GmailMeta } from "@/lib/echange-meta";

export { isGmailMeta, type GmailMeta };

type Message = { id: string; threadId: string; internalDate: string; snippet?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } };
type Boite = { cle: string; userId: string | null; email: string | null; client: OAuth2Client };

const addr = (s: string) => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();
const nameOf = (s: string) => s.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || null;

/** Boîtes Gmail connectées : agence + membres de l'équipe. */
async function boites(): Promise<Boite[]> {
  if (!oauthConfigured()) return [];
  const out: Boite[] = [];
  const agence = await connectedGoogleClient();
  if (agence) out.push({ cle: "", userId: null, email: (await prisma.setting.findUnique({ where: { key: "google_account_email" } }))?.value ?? null, client: agence });
  const users = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] }, googleRefreshToken: { not: null } }, select: { id: true, googleRefreshToken: true, googleEmail: true } });
  for (const u of users) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: u.googleRefreshToken! });
    out.push({ cle: `${u.id}:`, userId: u.id, email: u.googleEmail, client });
  }
  return out;
}

export const gmailConfigured = async () => (await boites()).length > 0;

/** Synchronise les mails d'une fiche (adresses de ses contacts) dans toutes les boîtes connectées. */
export async function syncProspectEmails(prospectId: string): Promise<{ added: number; error?: string }> {
  const bs = await boites();
  if (!bs.length) return { added: 0 };
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { contacts: { select: { email: true } } } });
  const emails = [...new Set((p?.contacts ?? []).map((c) => c.email?.trim().toLowerCase()).filter((e): e is string => !!e && e.includes("@")))].slice(0, 5);
  if (!emails.length) return { added: 0 };
  const users = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, select: { id: true, email: true, googleEmail: true } });
  const userByEmail = new Map<string, string>();
  for (const u of users) { userByEmail.set(u.email.toLowerCase(), u.id); if (u.googleEmail) userByEmail.set(u.googleEmail.toLowerCase(), u.id); }
  const q = emails.map((e) => `from:${e} OR to:${e}`).join(" OR ");
  let added = 0;
  const erreurs: string[] = [];
  for (const b of bs) {
    try {
      const list = await b.client.request<{ messages?: { id: string }[] }>({ url: "https://gmail.googleapis.com/gmail/v1/users/me/messages", params: { q, maxResults: 50 } });
      const ids = (list.data.messages ?? []).map((m) => m.id);
      if (!ids.length) continue;
      const known = new Set((await prisma.echange.findMany({ where: { externalId: { in: ids.map((id) => `gmail:${b.cle}${id}`) } }, select: { externalId: true } })).map((e) => e.externalId));
      for (const id of ids.filter((id) => !known.has(`gmail:${b.cle}${id}`))) {
        const res = await b.client.request<Message>({ url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, params: { format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"] } });
        const m = res.data;
        const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
        const de = h("From"), a = h("To"), objet = h("Subject") || "(sans objet)";
        const direction: GmailMeta["direction"] = emails.includes(addr(de)) ? "recu" : "envoye";
        const meta: GmailMeta = { source: "gmail", messageId: m.id, threadId: m.threadId, direction, objet, de, a, extrait: (m.snippet ?? "").trim(), boite: b.email };
        const auteurId = direction === "envoye" ? b.userId ?? userByEmail.get(addr(de)) ?? null : null;
        await prisma.echange.create({
          data: {
            prospectId, type: "MAIL", origine: "gmail", externalId: `gmail:${b.cle}${m.id}`, date: new Date(Number(m.internalDate)),
            notes: `${direction === "recu" ? "Mail reçu" : "Mail envoyé"} : ${objet}${meta.extrait ? `\n${meta.extrait}` : ""}`,
            auteurId, auteurNom: auteurId ? null : nameOf(de) ?? addr(de), meta: meta as unknown as Prisma.InputJsonObject,
          },
        });
        added++;
      }
    } catch (e) {
      const st = (e as { response?: { status?: number } }).response?.status;
      erreurs.push(st === 403 || st === 401 ? `Gmail (${b.email ?? "agence"}) : reconnectez ce compte Google dans Paramètres pour autoriser la lecture des emails.` : `Gmail (${b.email ?? "agence"}) : ${(e as Error).message}`);
      console.warn("[gmail]", erreurs.at(-1));
    }
  }
  return { added, error: erreurs.length ? erreurs.join(" ") : undefined };
}
