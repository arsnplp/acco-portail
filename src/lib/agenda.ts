/**
 * Google Agenda personnel de chaque membre : les RDV prospects qui lui sont attribués et les échéances des sites qu'il suit
 * (commercial) ou développe sont poussés dans son agenda principal. Clé interne → id Google dans AgendaEvent (mise à jour, pas de doublon).
 */
import { prisma } from "@/lib/prisma";
import { userGoogleClient } from "@/lib/google-oauth";
import { contactName } from "@/lib/crm";
import { PROJECT_STEPS } from "@/lib/labels";
import { connecteurActif } from "@/lib/connecteurs";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "";
type Ev = { titre: string; debut: Date; fin?: Date; jour?: boolean; description?: string | null; lieu?: string | null; invites?: string[]; meet?: boolean };
type GEvent = { id: string; status?: string; hangoutLink?: string; location?: string; updated?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };

function body(e: Ev) {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const attendees = e.invites?.length ? e.invites.map((email) => ({ email })) : undefined;
  return e.jour
    ? { summary: e.titre, description: e.description ?? undefined, location: e.lieu ?? undefined, start: { date: day(e.debut) }, end: { date: day(new Date(e.debut.getTime() + 86400_000)) } }
    : { summary: e.titre, description: e.description ?? undefined, location: e.lieu ?? undefined, attendees, start: { dateTime: e.debut.toISOString(), timeZone: "Europe/Paris" }, end: { dateTime: (e.fin ?? new Date(e.debut.getTime() + 3600_000)).toISOString(), timeZone: "Europe/Paris" }, ...(e.meet && { conferenceData: { createRequest: { requestId: `acco-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } } }) };
}

/** Crée ou met à jour l'événement `cle` dans l'agenda de `userId` (identifiant stable). Renvoie le lien Meet s'il existe. Silencieux sans Google. */
export async function upsertAgendaEvent(userId: string, cle: string, e: Ev): Promise<{ ok: boolean; meetUrl?: string | null }> {
  if (!(await connecteurActif("calendar"))) return { ok: false }; // 00.7 : connecteur coupé = agenda interne seul
  const client = await userGoogleClient(userId);
  if (!client) return { ok: false };
  const existing = await prisma.agendaEvent.findUnique({ where: { userId_cle: { userId, cle } } });
  const params = { conferenceDataVersion: 1, sendUpdates: e.invites?.length ? "all" : "none" };
  try {
    if (existing) {
      const res = await client.request<GEvent>({ url: `${API}/${existing.googleEventId}`, method: "PUT", params, data: body(e) });
      await prisma.agendaEvent.update({ where: { id: existing.id }, data: { updatedAt: new Date() } });
      return { ok: true, meetUrl: res.data.hangoutLink ?? null };
    }
    const res = await client.request<GEvent>({ url: API, method: "POST", params, data: body(e) });
    await prisma.agendaEvent.create({ data: { userId, cle, googleEventId: res.data.id } });
    return { ok: true, meetUrl: res.data.hangoutLink ?? null };
  } catch (err) {
    const st = (err as { response?: { status?: number } }).response?.status;
    if (existing && (st === 404 || st === 410)) { await prisma.agendaEvent.delete({ where: { id: existing.id } }); return upsertAgendaEvent(userId, cle, e); } // supprimé côté Google : on recrée
    throw err;
  }
}

export async function deleteAgendaEvent(userId: string, cle: string) {
  const existing = await prisma.agendaEvent.findUnique({ where: { userId_cle: { userId, cle } } });
  if (!existing) return;
  const client = (await connecteurActif("calendar")) ? await userGoogleClient(userId) : null;
  if (client) await client.request({ url: `${API}/${existing.googleEventId}`, method: "DELETE" }).catch(() => null);
  await prisma.agendaEvent.delete({ where: { id: existing.id } });
}

/** Pousse dans l'agenda du membre tous ses RDV à venir et les échéances de ses sites ; retire ce qui n'a plus lieu d'être. */
export async function syncAgendaForUser(userId: string): Promise<{ ok: boolean; rdv: number; echeances: number; error?: string }> {
  if (!(await connecteurActif("calendar"))) return { ok: false, rdv: 0, echeances: 0, error: "Le connecteur Google Agenda est désactivé (Administration → IA et intégrations)." };
  if (!(await userGoogleClient(userId))) return { ok: false, rdv: 0, echeances: 0, error: "Compte Google non connecté." };
  const depuis = new Date(Date.now() - 86400_000);
  const [rdvs, sites] = await Promise.all([
    prisma.rendezVous.findMany({ where: { commercialId: userId, resultat: "PREVU", debut: { gte: depuis } }, include: { prospect: { select: { id: true, societe: true, telephone: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, telephone: true } } } }, client: { select: { id: true, name: true } }, site: { select: { name: true } }, commercial: { select: { firstName: true, lastName: true, email: true } } } }),
    prisma.site.findMany({ where: { status: "EN_CREATION", OR: [{ developpeurId: userId }, { client: { commercialId: userId } }] }, select: { id: true, name: true, deadlineV1: true, deadlineV2: true, deadlineLivraison: true, client: { select: { name: true } } } }),
  ]);
  const voulus = new Map<string, Ev & { rdvId?: string }>();
  for (const r of rdvs) {
    // Invitation aux contacts et aux collègues choisis, visio Meet si demandée (une fois : le lien est ensuite conservé), description du modèle de l'agence.
    const commun = { fin: new Date(r.debut.getTime() + r.dureeMin * 60_000), lieu: r.lieu, invites: r.invites, meet: r.meet && !r.meetUrl, rdvId: r.id };
    if (r.prospect) {
      const qui = contactName(r.prospect.contacts[0]);
      voulus.set(`rdv:${r.id}`, { ...commun, titre: `RDV ${qui ?? r.prospect.societe}${qui ? ` · ${r.prospect.societe}` : ""}`, debut: r.debut, description: r.description ?? `${r.prospect.contacts[0]?.telephone ?? r.prospect.telephone ?? ""}\n${APP}/crm/prospects/${r.prospect.id}` });
    } else if (r.client) {
      voulus.set(`rdv-client:${r.id}`, { ...commun, titre: `${r.titre ?? "RDV"} · ${r.client.name}${r.site ? ` (${r.site.name})` : ""}`, debut: r.debut, description: r.description ?? `${APP}/admin/clients/${r.client.id}?onglet=taches` });
    }
  }
  for (const s of sites) {
    const libelle = { v1: "Présentation V1", v2: "V2", livraison: "Livraison" } as const;
    for (const [k, d] of [["v1", s.deadlineV1], ["v2", s.deadlineV2], ["livraison", s.deadlineLivraison]] as const) {
      if (d && d >= depuis) voulus.set(`site:${s.id}:${k}`, { titre: `${libelle[k]} · ${s.name}`, debut: d, jour: true, description: `${s.client.name}\n${APP}/admin/sites/${s.id}` });
    }
  }
  let rdv = 0, echeances = 0;
  try {
    const connus = await prisma.agendaEvent.findMany({ where: { userId } });
    for (const [cle, ev] of voulus) {
      const r = await upsertAgendaEvent(userId, cle, ev);
      if (r.meetUrl && ev.rdvId) await prisma.rendezVous.update({ where: { id: ev.rdvId }, data: { meetUrl: r.meetUrl } }).catch(() => null);
      if (cle.startsWith("rdv")) rdv++; else echeances++;
    }
    // Plus à venir (RDV annulé, échéance retirée) : on retire de l'agenda. Les RDV passés restent dans l'historique Google.
    const passes = new Set((await prisma.rendezVous.findMany({ where: { commercialId: userId, debut: { lt: depuis }, resultat: { in: ["PREVU", "FAIT"] } }, select: { id: true, prospectId: true } })).map((r) => `${r.prospectId ? "rdv" : "rdv-client"}:${r.id}`));
    for (const c of connus) if (!voulus.has(c.cle) && !passes.has(c.cle)) await deleteAgendaEvent(userId, c.cle);
    return { ok: true, rdv, echeances };
  } catch (err) {
    const e = err as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
    const msg = e.response?.data?.error?.message ?? e.message ?? "";
    const lisible = /has not been used|is disabled|accessNotConfigured/i.test(msg) ? "L’API Google Calendar n’est pas activée dans le projet Google Cloud."
      : /insufficient|scope/i.test(msg) || e.response?.status === 403 ? "Permission Agenda manquante : déconnectez puis reconnectez votre compte Google."
      : /invalid_grant/i.test(msg) || e.response?.status === 401 ? "Connexion Google expirée : reconnectez votre compte." : msg;
    console.warn("[agenda]", userId, lisible);
    return { ok: false, rdv, echeances, error: lisible };
  }
}

/**
 * Sens Google → application (section 7) : un RDV déplacé ou annulé dans Google Agenda met à jour le RDV de l'app
 * (identifiant stable par AgendaEvent). Jamais de boucle : on ne repousse pas vers Google ce qu'on vient de lire.
 */
export async function pullAgendaForUser(userId: string) {
  if (!(await connecteurActif("calendar"))) return { maj: 0 };
  const client = await userGoogleClient(userId);
  if (!client) return { maj: 0 };
  const connus = await prisma.agendaEvent.findMany({ where: { userId, cle: { startsWith: "rdv" } } });
  let maj = 0;
  for (const c of connus) {
    const rdvId = c.cle.split(":")[1];
    try {
      const res = await client.request<GEvent>({ url: `${API}/${c.googleEventId}` });
      const ev = res.data;
      const rdv = await prisma.rendezVous.findUnique({ where: { id: rdvId } });
      if (!rdv || rdv.resultat !== "PREVU") continue;
      if (ev.status === "cancelled") {
        await prisma.rendezVous.update({ where: { id: rdvId }, data: { resultat: "ANNULE" } });
        await prisma.agendaEvent.delete({ where: { id: c.id } }).catch(() => null);
        maj++; continue;
      }
      const debut = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
      const fin = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
      if (!debut) continue;
      const dureeMin = fin ? Math.max(15, Math.round((fin.getTime() - debut.getTime()) / 60_000)) : rdv.dureeMin;
      const lieu = ev.location ?? rdv.lieu;
      const meetUrl = ev.hangoutLink ?? rdv.meetUrl;
      if (debut.getTime() !== rdv.debut.getTime() || dureeMin !== rdv.dureeMin || lieu !== rdv.lieu || meetUrl !== rdv.meetUrl) {
        await prisma.rendezVous.update({ where: { id: rdvId }, data: { debut, dureeMin, lieu, meetUrl, googleEventId: c.googleEventId } });
        maj++;
      }
    } catch (err) {
      const st = (err as { response?: { status?: number } }).response?.status;
      if (st === 404 || st === 410) { await prisma.rendezVous.updateMany({ where: { id: rdvId, resultat: "PREVU" }, data: { resultat: "ANNULE" } }); await prisma.agendaEvent.delete({ where: { id: c.id } }).catch(() => null); maj++; }
      else { const { journal } = await import("@/lib/connecteurs"); await journal("calendar", "erreur", (err as Error).message); }
    }
  }
  return { maj };
}

/** Google → app : les événements du membre qui ne viennent pas de l'app (7 jours en arrière, 60 jours en avant) sont copiés pour s'afficher dans le calendrier. */
export async function importerAgendaExterne(userId: string) {
  if (!(await connecteurActif("calendar"))) return { importes: 0 };
  const client = await userGoogleClient(userId);
  if (!client) return { importes: 0 };
  const timeMin = new Date(Date.now() - 7 * 86400_000), timeMax = new Date(Date.now() + 60 * 86400_000);
  const notres = new Set((await prisma.agendaEvent.findMany({ where: { userId }, select: { googleEventId: true } })).map((e) => e.googleEventId));
  const res = await client.request<{ items?: (GEvent & { summary?: string; attendees?: { self?: boolean; responseStatus?: string }[] })[] }>({ url: API, params: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: true, orderBy: "startTime", maxResults: 250 } });
  const vus = new Set<string>();
  let importes = 0;
  for (const ev of res.data.items ?? []) {
    if (!ev.id || ev.status === "cancelled" || notres.has(ev.id)) continue;
    if (ev.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
    const jour = !!ev.start?.date;
    const debut = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(`${ev.start.date}T12:00:00Z`) : null;
    const fin = ev.end?.dateTime ? new Date(ev.end.dateTime) : debut ? new Date(debut.getTime() + 3600_000) : null;
    if (!debut || !fin) continue;
    vus.add(ev.id);
    await prisma.agendaExterne.upsert({ where: { userId_googleEventId: { userId, googleEventId: ev.id } }, create: { userId, googleEventId: ev.id, titre: ev.summary ?? "(sans titre)", debut, fin, jour, lieu: ev.location ?? null, meetUrl: ev.hangoutLink ?? null }, update: { titre: ev.summary ?? "(sans titre)", debut, fin, jour, lieu: ev.location ?? null, meetUrl: ev.hangoutLink ?? null } });
    importes++;
  }
  await prisma.agendaExterne.deleteMany({ where: { userId, debut: { gte: timeMin, lte: timeMax }, googleEventId: { notIn: [...vus] } } });
  return { importes };
}

/** Synchronisation planifiée des agendas (toutes les 15 min) : Google → app puis app → Google, pour chaque membre connecté. */
export async function syncAgendasPlanifiee() {
  if (!(await connecteurActif("calendar"))) return { membres: 0 };
  const users = await prisma.user.findMany({ where: { googleRefreshToken: { not: null }, role: { not: "CLIENT" } }, select: { id: true } });
  for (const u of users) {
    await pullAgendaForUser(u.id).catch((e) => console.warn("[agenda]", (e as Error).message));
    await importerAgendaExterne(u.id).catch(async (e) => { const { journal } = await import("@/lib/connecteurs"); await journal("calendar", "erreur", `Import Google (${u.id}) : ${(e as Error).message}`); });
    await syncAgendaForUser(u.id).catch((e) => console.warn("[agenda]", (e as Error).message));
  }
  const { marquerSync } = await import("@/lib/connecteurs");
  if (users.length) await marquerSync("calendar");
  return { membres: users.length };
}
export function startAgendaTicker() {
  const g = globalThis as { __agendaTicker?: NodeJS.Timeout };
  if (g.__agendaTicker) return;
  const tick = () => syncAgendasPlanifiee().catch((e) => console.warn("[agenda]", (e as Error).message));
  setTimeout(tick, 120_000);
  g.__agendaTicker = setInterval(tick, 15 * 60_000);
}

/** Après un changement de RDV ou d'échéance : resynchronise les agendas concernés (jamais bloquant). */
export async function syncAgendaUsers(userIds: (string | null | undefined)[]) {
  for (const id of new Set(userIds.filter((x): x is string => !!x))) await syncAgendaForUser(id).catch((e) => console.warn("[agenda]", (e as Error).message));
}
export { PROJECT_STEPS };
