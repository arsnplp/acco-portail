/**
 * Aircall (téléphonie) : les appels passés et reçus arrivent dans l'historique des fiches prospects, avec
 * l'enregistrement et les analyses IA d'Aircall (résumé, sujets, sentiment, transcription).
 * - Synchronisation générale toutes les 5 minutes (instrumentation.ts) ou par cron (/api/cron/aircall) ;
 * - synchronisation d'une fiche à son ouverture (recherche par numéro) ;
 * - un appel déjà noté à la main (NRP, Appel…) dans les 20 minutes autour de l'appel est enrichi, pas dupliqué.
 * Clés : Admin → Paramètres (ou AIRCALL_API_ID / AIRCALL_API_TOKEN dans .env). Documentation : developer.aircall.io.
 */
import type { EchangeType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/roles";
import { featureEnabled, getSecret } from "@/lib/settings";
import { normPhone } from "@/lib/crm";
import { fmtDuree, isAircallMeta, type AircallMeta } from "@/lib/echange-meta";

export { fmtDuree, isAircallMeta, type AircallMeta };

const API = "https://api.aircall.io/v1";

export type AircallCall = {
  id: number; direction: "inbound" | "outbound"; status: string; missed_call_reason: string | null;
  started_at: number; answered_at: number | null; ended_at: number | null; duration: number;
  recording: string | null; recording_short_url?: string | null; voicemail: string | null; asset: string | null; raw_digits: string;
  user: { id: number; name: string; email: string } | null; number: { name: string; digits: string } | null;
  comments?: { content: string }[]; tags?: { name: string }[];
};
type Utterance = { text: string; participant_type: "internal" | "external"; start_time: number };


export const aircallConfigured = () => featureEnabled("feature_aircall");

async function headers() {
  const [id, token] = await Promise.all([getSecret("aircall_api_id"), getSecret("aircall_api_token")]);
  if (!id || !token) throw new Error("Clés Aircall manquantes (Admin → Paramètres).");
  return { Authorization: `Basic ${Buffer.from(`${id}:${token}`).toString("base64")}`, Accept: "application/json" };
}

/** Appel GET à l'API ; null si la ressource n'existe pas (404 : pas de transcription, pas de résumé…). */
async function get<T>(path: string, params?: Record<string, string | number>, retry = 1): Promise<T | null> {
  const url = `${API}${path}${params ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))}` : ""}`;
  const res = await fetch(url, { headers: await headers(), signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (res.status === 404) return null;
  if (res.status === 429 && retry > 0) { await new Promise((r) => setTimeout(r, 1500)); return get<T>(path, params, retry - 1); }
  if (res.status === 401 || res.status === 403) throw new Error(`Aircall refuse l’accès (${res.status}) : vérifiez les clés et la licence AI Assist.`);
  if (!res.ok) throw new Error(`Aircall répond ${res.status} sur ${path}.`);
  return (await res.json()) as T;
}

/** Numéro au format international d'Aircall (« 06 12 34 56 78 » → « +33612345678 »). */
export function e164(tel: string | null | undefined) {
  const d = normPhone(tel);
  if (!d) return null;
  return d.startsWith("+") ? d : d.startsWith("0") ? `+33${d.slice(1)}` : `+${d}`;
}

/** Appels depuis une date (unix, secondes), du plus ancien au plus récent. 20 pages de 50 au plus par passage. */
export async function listCallsSince(fromUnix: number) {
  const out: AircallCall[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await get<{ calls: AircallCall[]; meta: { next_page_link: string | null } }>("/calls", { from: fromUnix, order: "asc", per_page: 50, page });
    if (!res) break;
    out.push(...res.calls);
    if (!res.meta.next_page_link) break;
  }
  return out;
}

/** Appels échangés avec un numéro (recherche Aircall), les plus récents d'abord. */
export async function searchCalls(tel: string) {
  const phone = e164(tel);
  if (!phone) return [];
  const res = await get<{ calls: AircallCall[] }>("/calls/search", { phone_number: phone, per_page: 50, order: "desc" });
  return res?.calls ?? [];
}

/** Lien d'écoute frais (les liens Aircall expirent au bout d'une heure environ). */
export async function recordingUrl(callId: number) {
  const res = await get<{ call: AircallCall }>(`/calls/${callId}`);
  return res?.call.recording ?? res?.call.voicemail ?? null;
}

/** Analyses IA d'Aircall (AI Assist) : résumé, sujets, sentiment, transcription. Chacune peut manquer (404). */
async function insights(callId: number) {
  const [t, s, se, to] = await Promise.all([
    get<{ transcription: { content: { utterances: Utterance[] } } }>(`/calls/${callId}/transcription`).catch(() => null),
    get<{ summary: { content: string } }>(`/calls/${callId}/summary`).catch(() => null),
    get<{ sentiment: { participants: { value: string; type: string }[] } }>(`/calls/${callId}/sentiments`).catch(() => null),
    get<{ topic: { content: string[] } }>(`/calls/${callId}/topics`).catch(() => null),
  ]);
  // Transcription compactée : on regroupe les phrases consécutives du même interlocuteur.
  const transcription: AircallMeta["transcription"] = t ? [] : null;
  for (const u of t?.transcription.content.utterances ?? []) {
    const qui = u.participant_type === "internal" ? "nous" : "prospect";
    const last = transcription![transcription!.length - 1];
    if (last && last.qui === qui) last.texte += ` ${u.text}`; else transcription!.push({ qui, texte: u.text });
  }
  const ext = se?.sentiment.participants.find((p) => p.type === "external") ?? se?.sentiment.participants[0];
  return { resume: s?.summary.content?.trim() || null, sujets: to?.topic.content ?? [], sentiment: ext?.value ?? null, transcription: transcription && transcription.length ? transcription : null };
}

function baseMeta(c: AircallCall): AircallMeta {
  const repondu = !!c.answered_at;
  return {
    source: "aircall", aircallId: c.id, direction: c.direction, repondu, dureeSec: repondu && c.answered_at && c.ended_at ? Math.max(0, c.ended_at - c.answered_at) : 0,
    motifManque: c.missed_call_reason, agent: c.user?.name ?? null, numero: c.raw_digits, ligne: c.number?.name ?? null,
    enregistrement: !!c.recording, messagerie: !!c.voicemail, resume: null, sujets: [], sentiment: null, transcription: null, analysePending: false,
  };
}

/** Analyses IA : seulement pour les appels répondus d'au moins 20 s ; « en attente » tant qu'elles manquent (elles arrivent après l'appel). */
async function withInsights(meta: AircallMeta, c: AircallCall): Promise<AircallMeta> {
  if (!meta.repondu || meta.dureeSec < 20) return meta;
  const endedMs = (c.ended_at ?? c.started_at) * 1000;
  const i = await insights(c.id);
  const complet = !!(i.resume && i.transcription);
  return { ...meta, ...i, analysePending: !complet && Date.now() - endedMs < 48 * 3600_000 };
}

/** Note lisible de l'appel (pour l'historique général, les stats et la recherche). */
export function noteAppel(m: AircallMeta) {
  if (m.resume) return m.resume;
  if (m.repondu) return `${m.direction === "outbound" ? "Appel sortant" : "Appel entrant"} de ${fmtDuree(m.dureeSec)} (Aircall)${m.enregistrement ? " · enregistré" : ""}`;
  if (m.direction === "inbound") return `Appel entrant manqué (Aircall)${m.messagerie ? " · message vocal" : ""}`;
  return `Appel sans réponse (Aircall)${m.motifManque ? ` · ${m.motifManque.replace(/_/g, " ")}` : ""}`;
}

/** Type d'échange pour un appel : répondu = Appel ; sortant sans réponse = NRP ; entrant manqué = simple note (ce n'est pas un NRP). */
const typeAppel = (m: AircallMeta): EchangeType => (m.repondu ? "APPEL" : m.direction === "outbound" ? "NRP" : "NOTE");

type Index = { byPhone: Map<string, string>; userByEmail: Map<string, string> };

async function buildIndex(prospectIds?: string[]): Promise<Index> {
  const [prospects, users] = await Promise.all([
    prisma.prospect.findMany({ where: prospectIds ? { id: { in: prospectIds } } : {}, select: { id: true, telephone: true, statut: true, contacts: { select: { telephone: true } } } }),
    prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, select: { id: true, email: true } }),
  ]);
  const byPhone = new Map<string, string>();
  // Une fiche ouverte passe avant une fiche close si deux fiches partagent un numéro.
  for (const p of [...prospects].sort((a, b) => Number(["GAGNE", "PERDU", "ABANDON"].includes(a.statut)) - Number(["GAGNE", "PERDU", "ABANDON"].includes(b.statut)))) {
    for (const t of [p.telephone, ...p.contacts.map((c) => c.telephone)]) { const n = normPhone(t); if (n && !byPhone.has(n)) byPhone.set(n, p.id); }
  }
  return { byPhone, userByEmail: new Map(users.map((u) => [u.email.toLowerCase(), u.id])) };
}

/** Enregistre (ou enrichit) l'échange correspondant à un appel. Renvoie true si quelque chose a été écrit. */
async function upsertCall(c: AircallCall, prospectId: string, idx: Index) {
  const externalId = `aircall:${c.id}`;
  const existing = await prisma.echange.findUnique({ where: { externalId }, select: { id: true, meta: true } });
  if (existing) {
    const m = existing.meta as AircallMeta | null;
    if (!m?.analysePending) return false;
    const meta = await withInsights({ ...m, enregistrement: !!c.recording || m.enregistrement }, c);
    await prisma.echange.update({ where: { id: existing.id }, data: { meta: meta as unknown as Prisma.InputJsonObject, ...(meta.resume && !m.resume ? { notes: await notesWithResume(existing.id, meta) } : {}) } });
    return true;
  }
  const meta = await withInsights(baseMeta(c), c);
  const date = new Date(c.started_at * 1000);
  const auteurId = c.user?.email ? idx.userByEmail.get(c.user.email.toLowerCase()) ?? null : null;
  // Déjà noté à la main autour de l'appel (NRP, Appel, Prise de RDV, RDV) : on rattache l'appel à cette note au lieu d'en créer une deuxième.
  const manuel = await prisma.echange.findFirst({
    where: { prospectId, externalId: null, origine: "saisie", type: { in: ["NRP", "APPEL", "PRISE_RDV", "RDV"] }, date: { gte: new Date(date.getTime() - 20 * 60_000), lte: new Date(date.getTime() + 40 * 60_000) } },
    orderBy: { date: "asc" }, select: { id: true, notes: true },
  });
  if (manuel) {
    await prisma.echange.update({ where: { id: manuel.id }, data: { externalId, meta: meta as unknown as Prisma.InputJsonObject } });
    return true;
  }
  await prisma.echange.create({ data: { prospectId, type: typeAppel(meta), notes: noteAppel(meta), date, auteurId, auteurNom: auteurId ? null : c.user?.name ?? null, origine: "aircall", externalId, meta: meta as unknown as Prisma.InputJsonObject } });
  return true;
}
/** Note enrichie du résumé IA arrivé après coup (pour une note créée par la synchro, pas une note écrite à la main). */
async function notesWithResume(echangeId: string, meta: AircallMeta) {
  const e = await prisma.echange.findUnique({ where: { id: echangeId }, select: { notes: true, origine: true } });
  return e?.origine === "aircall" ? noteAppel(meta) : e?.notes ?? null;
}

/** Synchronisation d'une fiche : appels Aircall de ses numéros. Renvoie le nombre d'échanges écrits. */
export async function syncProspectCalls(prospectId: string) {
  if (!(await aircallConfigured())) return 0;
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { telephone: true, contacts: { select: { telephone: true } } } });
  if (!p) return 0;
  const tels = [...new Set([p.telephone, ...p.contacts.map((c) => c.telephone)].map(normPhone).filter((t): t is string => !!t))].slice(0, 4);
  const idx = await buildIndex([prospectId]);
  let n = 0;
  const vus = new Set<number>();
  for (const tel of tels) {
    for (const c of await searchCalls(tel)) {
      if (vus.has(c.id) || c.status !== "done") continue;
      vus.add(c.id);
      if (await upsertCall(c, prospectId, idx)) n++;
    }
  }
  return n;
}

/** Synchronisation générale : nouveaux appels depuis le dernier passage (30 jours la première fois) + analyses en attente. */
export async function syncAircall() {
  if (!(await aircallConfigured())) return { calls: 0, matched: 0, skipped: true };
  const g = globalThis as unknown as { __accoAircallBusy?: boolean };
  if (g.__accoAircallBusy) return { calls: 0, matched: 0, skipped: true };
  g.__accoAircallBusy = true;
  try {
    const row = await prisma.setting.findUnique({ where: { key: "aircall_sync_from" } });
    const from = row ? Number(row.value) - 600 : Math.floor(Date.now() / 1000) - 30 * 86400;
    const calls = (await listCallsSince(from)).filter((c) => c.status === "done");
    const idx = await buildIndex();
    let matched = 0, last = row ? Number(row.value) : from;
    for (const c of calls) {
      last = Math.max(last, c.started_at);
      const prospectId = idx.byPhone.get(normPhone(c.raw_digits) ?? "");
      if (!prospectId) continue;
      try { if (await upsertCall(c, prospectId, idx)) matched++; } catch (e) { console.warn("[aircall]", c.id, (e as Error).message); }
    }
    // Analyses IA arrivées depuis : on repasse sur les appels récents encore « en attente » (30 par passage).
    const pending = await prisma.echange.findMany({ where: { externalId: { startsWith: "aircall:" }, date: { gte: new Date(Date.now() - 48 * 3600_000) }, meta: { path: ["analysePending"], equals: true } }, select: { id: true, meta: true, prospectId: true }, take: 30 });
    for (const e of pending) {
      const m = e.meta as AircallMeta;
      if (calls.some((c) => c.id === m.aircallId) || !e.prospectId) continue; // déjà traité ci-dessus
      try {
        const c = (await get<{ call: AircallCall }>(`/calls/${m.aircallId}`))?.call;
        if (c) await upsertCall(c, e.prospectId, idx);
      } catch (err) { console.warn("[aircall] analyse", m.aircallId, (err as Error).message); }
    }
    await prisma.setting.upsert({ where: { key: "aircall_sync_from" }, create: { key: "aircall_sync_from", value: String(last) }, update: { value: String(last) } });
    return { calls: calls.length, matched, skipped: false };
  } finally {
    g.__accoAircallBusy = false;
  }
}

/** Vérifie Aircall toutes les 5 minutes tant que le serveur tourne (lancé par instrumentation.ts). */
export function startAircallTicker() {
  const g = globalThis as unknown as { __accoAircall?: NodeJS.Timeout };
  if (g.__accoAircall) return;
  const run = () => { syncAircall().catch((e) => console.warn("[aircall]", (e as Error).message)); };
  setTimeout(run, 20_000);
  g.__accoAircall = setInterval(run, 5 * 60_000);
}
