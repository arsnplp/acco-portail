/**
 * Emails échangés avec un prospect (envoyés et reçus), lus dans la boîte Gmail du compte Google connecté
 * dans Admin → Paramètres (lecture seule). Chaque mail devient un échange « Mail » (origine gmail) sur la fiche.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { connectedGoogleClient } from "@/lib/google-oauth";
import { isGmailMeta, type GmailMeta } from "@/lib/echange-meta";

export { isGmailMeta, type GmailMeta };

type Message = { id: string; threadId: string; internalDate: string; snippet?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } };

export const gmailConfigured = async () => !!(await connectedGoogleClient());

const addr = (s: string) => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();
const nameOf = (s: string) => s.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || null;

/** Synchronise les mails d'une fiche à partir des adresses de ses contacts. Renvoie le nombre de mails ajoutés. */
export async function syncProspectEmails(prospectId: string): Promise<{ added: number; error?: string }> {
  const client = await connectedGoogleClient();
  if (!client) return { added: 0 };
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { contacts: { select: { email: true } } } });
  const emails = [...new Set((p?.contacts ?? []).map((c) => c.email?.trim().toLowerCase()).filter((e): e is string => !!e && e.includes("@")))].slice(0, 5);
  if (!emails.length) return { added: 0 };
  const users = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  try {
    const q = emails.map((e) => `from:${e} OR to:${e}`).join(" OR ");
    const list = await client.request<{ messages?: { id: string }[] }>({ url: "https://gmail.googleapis.com/gmail/v1/users/me/messages", params: { q, maxResults: 50 } });
    const ids = (list.data.messages ?? []).map((m) => m.id);
    if (!ids.length) return { added: 0 };
    const known = new Set((await prisma.echange.findMany({ where: { externalId: { in: ids.map((id) => `gmail:${id}`) } }, select: { externalId: true } })).map((e) => e.externalId));
    let added = 0;
    for (const id of ids.filter((id) => !known.has(`gmail:${id}`))) {
      const res = await client.request<Message>({ url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, params: { format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"] } });
      const m = res.data;
      const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      const de = h("From"), a = h("To"), objet = h("Subject") || "(sans objet)";
      const direction: GmailMeta["direction"] = emails.includes(addr(de)) ? "recu" : "envoye";
      const meta: GmailMeta = { source: "gmail", messageId: m.id, threadId: m.threadId, direction, objet, de, a, extrait: (m.snippet ?? "").trim() };
      const auteurId = direction === "envoye" ? userByEmail.get(addr(de)) ?? null : null;
      await prisma.echange.create({
        data: {
          prospectId, type: "MAIL", origine: "gmail", externalId: `gmail:${m.id}`, date: new Date(Number(m.internalDate)),
          notes: `${direction === "recu" ? "Mail reçu" : "Mail envoyé"} : ${objet}${meta.extrait ? `\n${meta.extrait}` : ""}`,
          auteurId, auteurNom: auteurId ? null : nameOf(de) ?? addr(de), meta: meta as unknown as Prisma.InputJsonObject,
        },
      });
      added++;
    }
    return { added };
  } catch (e) {
    const st = (e as { response?: { status?: number } }).response?.status;
    const msg = st === 403 || st === 401 ? "Gmail : reconnectez Google dans Admin → Paramètres pour autoriser la lecture des emails." : `Gmail : ${(e as Error).message}`;
    console.warn("[gmail]", msg);
    return { added: 0, error: msg };
  }
}
