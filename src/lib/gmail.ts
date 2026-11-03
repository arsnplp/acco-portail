/**
 * Emails échangés avec une fiche (prospect ou client), entrants ET sortants, lus dans TOUTES les boîtes Gmail
 * connectées (agence + chaque collaborateur interne ayant relié son compte Google). Section 8.1 :
 * rattachement par les adresses de tous les contacts connus, dédoublonnage entre boîtes (en-tête Message-ID),
 * pièces jointes listées, reprise après interruption (fenêtre glissante), journal des erreurs, rattachement manuel,
 * réponse « STOP » = désinscription des messages commerciaux (00.4).
 */
import type { OAuth2Client } from "google-auth-library";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { connectedGoogleClient, oauthConfigured, oauthClient } from "@/lib/google-oauth";
import { isGmailMeta, type GmailMeta } from "@/lib/echange-meta";
import { connecteurActif, journal } from "@/lib/connecteurs";

export { isGmailMeta, type GmailMeta };

type Part = { filename?: string; mimeType?: string; body?: { size?: number; attachmentId?: string }; parts?: Part[] };
type Message = { id: string; threadId: string; internalDate: string; snippet?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[]; parts?: Part[] } };
type Boite = { cle: string; userId: string | null; email: string | null; client: OAuth2Client };

const addr = (s: string) => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();
const nameOf = (s: string) => s.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || null;
const adresses = (s: string) => s.split(",").map(addr).filter((a) => a.includes("@"));
const FIELDS = "id,threadId,internalDate,snippet,labelIds,payload(headers,parts(filename,mimeType,body(size,attachmentId),parts(filename,mimeType,body(size,attachmentId))))";
const HEADERS = ["From", "To", "Cc", "Subject", "Date", "Message-ID", "In-Reply-To"].map((h) => `metadataHeaders=${h}`).join("&");

/** Boîtes Gmail connectées : agence + membres internes (jamais les prestataires, section 13). */
async function boites(): Promise<Boite[]> {
  if (!oauthConfigured()) return [];
  const out: Boite[] = [];
  const agence = await connectedGoogleClient();
  if (agence) out.push({ cle: "", userId: null, email: (await prisma.setting.findUnique({ where: { key: "google_account_email" } }))?.value ?? null, client: agence });
  const users = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL", "DEV"] }, googleRefreshToken: { not: null } }, select: { id: true, googleRefreshToken: true, googleEmail: true } });
  for (const u of users) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: u.googleRefreshToken! });
    out.push({ cle: `${u.id}:`, userId: u.id, email: u.googleEmail, client });
  }
  return out;
}
export const gmailConfigured = async () => (await boites()).length > 0;

function piecesJointes(parts?: Part[]): string[] {
  const out: string[] = [];
  for (const p of parts ?? []) { if (p.filename) out.push(p.filename); out.push(...piecesJointes(p.parts)); }
  return out;
}
function lisible(b: Boite, e: unknown) {
  const err = e as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
  const st = err.response?.status, msg = err.response?.data?.error?.message ?? err.message ?? "";
  const qui = `Gmail (${b.email ?? "agence"})`;
  return /has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(msg) ? `${qui} : l’API Gmail n’est pas activée dans le projet Google Cloud (API et services → Bibliothèque → Gmail API → Activer), puis réessayez dans 2 minutes.`
    : /insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT|scope/i.test(msg) || st === 403 ? `${qui} : permission Gmail manquante, déconnectez puis reconnectez ce compte Google dans Paramètres.`
    : /invalid_grant|invalid_rapt|Token has been expired or revoked/i.test(msg) || st === 401 ? `${qui} : connexion Google expirée ou révoquée, reconnectez ce compte dans Paramètres.`
    : `${qui} : ${msg}`;
}

type Fiche = { prospectId: string | null; clientId: string | null; emails: string[]; contacts: { id: string; email: string | null }[] };
/** Adresses connues d'une fiche : contacts du prospect, contacts du client, email du client, comptes du portail. */
async function ficheDe(opts: { prospectId?: string | null; clientId?: string | null }): Promise<Fiche | null> {
  let prospectId = opts.prospectId ?? null, clientId = opts.clientId ?? null;
  if (prospectId && !clientId) clientId = (await prisma.prospect.findUnique({ where: { id: prospectId }, select: { clientId: true } }))?.clientId ?? null;
  if (clientId && !prospectId) prospectId = (await prisma.prospect.findFirst({ where: { clientId }, select: { id: true } }))?.id ?? null;
  if (!prospectId && !clientId) return null;
  const [contacts, client] = await Promise.all([
    prisma.prospectContact.findMany({ where: { OR: [...(prospectId ? [{ prospectId }] : []), ...(clientId ? [{ clientId }] : [])] }, select: { id: true, email: true } }),
    clientId ? prisma.client.findUnique({ where: { id: clientId }, select: { email: true, memberships: { select: { user: { select: { email: true } } } } } }) : null,
  ]);
  const emails = [...new Set([...contacts.map((c) => c.email), client?.email, ...(client?.memberships.map((m) => m.user.email) ?? [])].map((e) => e?.trim().toLowerCase()).filter((e): e is string => !!e && e.includes("@")))].slice(0, 8);
  return { prospectId, clientId, emails, contacts };
}

/** Réponse « STOP » d'un contact : désinscription des messages commerciaux (00.4). */
async function traiterStop(fiche: Fiche, de: string, objet: string, extrait: string) {
  if (!/^\s*stop\b/i.test(objet) && !/^\s*stop\b/i.test(extrait)) return;
  const email = addr(de);
  const c = fiche.contacts.find((x) => x.email?.toLowerCase() === email);
  if (c) await prisma.prospectContact.update({ where: { id: c.id }, data: { optOutCommercial: true } }).catch(() => null);
}

/**
 * Synchronise les mails d'une fiche dans toutes les boîtes. Fenêtre : depuis la dernière synchro moins 2 jours (reprise),
 * 90 jours la première fois. Un même message présent dans deux boîtes n'est enregistré qu'une fois (Message-ID).
 */
export async function syncEmailsFiche(opts: { prospectId?: string | null; clientId?: string | null; depuis?: Date | null }): Promise<{ added: number; error?: string }> {
  if (!(await connecteurActif("gmail"))) return { added: 0 };
  const bs = await boites();
  if (!bs.length) return { added: 0 };
  const fiche = await ficheDe(opts);
  if (!fiche || !fiche.emails.length) return { added: 0 };
  const users = await prisma.user.findMany({ where: { role: { not: "CLIENT" } }, select: { id: true, email: true, googleEmail: true } });
  const userByEmail = new Map<string, string>();
  for (const u of users) { userByEmail.set(u.email.toLowerCase(), u.id); if (u.googleEmail) userByEmail.set(u.googleEmail.toLowerCase(), u.id); }
  const depuis = opts.depuis ? new Date(opts.depuis.getTime() - 2 * 86400_000) : new Date(Date.now() - 90 * 86400_000);
  const q = `(${fiche.emails.map((e) => `from:${e} OR to:${e} OR cc:${e}`).join(" OR ")}) after:${Math.floor(depuis.getTime() / 1000)}`;
  const where = { OR: [...(fiche.prospectId ? [{ prospectId: fiche.prospectId }] : []), ...(fiche.clientId ? [{ clientId: fiche.clientId }] : [])] };
  const connus = new Set((await prisma.echange.findMany({ where: { ...where, origine: "gmail" }, select: { externalId: true, meta: true } })).flatMap((e) => [e.externalId ?? "", (e.meta as { messageIdHeader?: string } | null)?.messageIdHeader ?? ""]).filter(Boolean));
  let added = 0;
  const erreurs: string[] = [];
  for (const b of bs) {
    try {
      let pageToken: string | undefined;
      for (let page = 0; page < 4; page++) {
        const list = await b.client.request<{ messages?: { id: string }[]; nextPageToken?: string }>({ url: "https://gmail.googleapis.com/gmail/v1/users/me/messages", params: { q, maxResults: 50, ...(pageToken && { pageToken }) } });
        const ids = (list.data.messages ?? []).map((m) => m.id);
        for (const id of ids) {
          const externalId = `gmail:${b.cle}${id}`;
          if (connus.has(externalId)) continue;
          const res = await b.client.request<Message>({ url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&${HEADERS}&fields=${encodeURIComponent(FIELDS)}` });
          const m = res.data;
          const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
          const messageIdHeader = h("Message-ID");
          if (messageIdHeader && connus.has(messageIdHeader)) { connus.add(externalId); continue; } // même mail déjà vu dans une autre boîte
          const de = h("From"), a = h("To"), cc = h("Cc"), objet = h("Subject") || "(sans objet)";
          const direction: GmailMeta["direction"] = fiche.emails.includes(addr(de)) ? "recu" : "envoye";
          const pj = piecesJointes(m.payload?.parts);
          const contact = fiche.contacts.find((c) => c.email && [addr(de), ...adresses(a), ...adresses(cc)].includes(c.email.toLowerCase()));
          const meta: GmailMeta & { messageIdHeader?: string; cc?: string; piecesJointes?: string[]; contactId?: string | null; threadId: string } = { source: "gmail", messageId: m.id, threadId: m.threadId, direction, objet, de, a, cc, extrait: (m.snippet ?? "").trim(), boite: b.email, messageIdHeader, piecesJointes: pj, contactId: contact?.id ?? null };
          const auteurId = direction === "envoye" ? b.userId ?? userByEmail.get(addr(de)) ?? null : null;
          await prisma.echange.create({ data: {
            prospectId: fiche.prospectId, clientId: fiche.clientId, type: "MAIL", origine: "gmail", externalId, date: new Date(Number(m.internalDate)),
            notes: `${direction === "recu" ? "Mail reçu" : "Mail envoyé"} : ${objet}${meta.extrait ? `\n${meta.extrait}` : ""}${pj.length ? `\nPièces jointes : ${pj.join(", ")}` : ""}`,
            auteurId, auteurNom: auteurId ? null : nameOf(de) ?? addr(de), meta: meta as unknown as Prisma.InputJsonObject,
          } });
          connus.add(externalId); if (messageIdHeader) connus.add(messageIdHeader);
          added++;
          if (direction === "recu") await traiterStop(fiche, de, objet, meta.extrait);
        }
        pageToken = list.data.nextPageToken;
        if (!pageToken) break;
      }
    } catch (e) {
      const msg = lisible(b, e);
      erreurs.push(msg);
      await journal("gmail", "erreur", msg);
    }
  }
  return { added, error: erreurs.length ? erreurs.join(" ") : undefined };
}

/** Compatibilité : synchronisation d'une fiche prospect (fenêtre depuis sa dernière synchro). */
export async function syncProspectEmails(prospectId: string): Promise<{ added: number; error?: string }> {
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { syncAt: true } });
  return syncEmailsFiche({ prospectId, depuis: p?.syncAt ?? null });
}
export async function syncClientEmails(clientId: string): Promise<{ added: number; error?: string }> {
  const key = `sync_client:${clientId}`;
  const row = await prisma.setting.findUnique({ where: { key } });
  const r = await syncEmailsFiche({ clientId, depuis: row ? new Date(row.value) : null });
  await prisma.setting.upsert({ where: { key }, create: { key, value: new Date().toISOString() }, update: { value: new Date().toISOString() } }).catch(() => null);
  return r;
}

/** Rattachement manuel (8.1) : un message Gmail non reconnu (identifiant du message ou lien Gmail) est attaché à un client. */
export async function rattacherMessageGmail(clientId: string, ref: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await connecteurActif("gmail"))) return { ok: false, error: "Connecteur Gmail désactivé." };
  const messageId = (/[#/]([0-9a-f]{12,})$/i.exec(ref.trim())?.[1] ?? ref.trim()).replace(/[^0-9a-zA-Z]/g, "");
  if (!messageId) return { ok: false, error: "Collez l’identifiant du message (ou l’adresse Gmail du message)." };
  const fiche = await ficheDe({ clientId });
  if (!fiche) return { ok: false, error: "Client introuvable." };
  for (const b of await boites()) {
    try {
      const res = await b.client.request<Message>({ url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&${HEADERS}` });
      const m = res.data;
      const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      const de = h("From"), a = h("To"), objet = h("Subject") || "(sans objet)";
      const externalId = `gmail:${b.cle}${m.id}`;
      if (await prisma.echange.findUnique({ where: { externalId } })) return { ok: false, error: "Ce message est déjà rattaché." };
      const direction: GmailMeta["direction"] = b.email && addr(de) === b.email.toLowerCase() ? "envoye" : "recu";
      const meta: GmailMeta & { messageIdHeader?: string; rattacheParId?: string } = { source: "gmail", messageId: m.id, threadId: m.threadId, direction, objet, de, a, extrait: (m.snippet ?? "").trim(), boite: b.email, messageIdHeader: h("Message-ID"), rattacheParId: userId };
      await prisma.echange.create({ data: { prospectId: fiche.prospectId, clientId, type: "MAIL", origine: "gmail", externalId, date: new Date(Number(m.internalDate)), notes: `${direction === "recu" ? "Mail reçu" : "Mail envoyé"} : ${objet}${meta.extrait ? `\n${meta.extrait}` : ""}`, auteurId: direction === "envoye" ? b.userId : null, auteurNom: direction === "recu" ? nameOf(de) ?? addr(de) : null, meta: meta as unknown as Prisma.InputJsonObject } });
      return { ok: true };
    } catch (e) {
      const st = (e as { response?: { status?: number } }).response?.status;
      if (st !== 404) await journal("gmail", "erreur", lisible(b, e));
    }
  }
  return { ok: false, error: "Message introuvable dans les boîtes connectées." };
}
