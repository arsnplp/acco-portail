/**
 * Google Agenda personnel de chaque membre : les RDV prospects qui lui sont attribués et les échéances des sites qu'il suit
 * (commercial) ou développe sont poussés dans son agenda principal. Clé interne → id Google dans AgendaEvent (mise à jour, pas de doublon).
 */
import { prisma } from "@/lib/prisma";
import { userGoogleClient } from "@/lib/google-oauth";
import { contactName } from "@/lib/crm";
import { PROJECT_STEPS } from "@/lib/labels";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "";
type Ev = { titre: string; debut: Date; fin?: Date; jour?: boolean; description?: string | null; lieu?: string | null };

function body(e: Ev) {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  return e.jour
    ? { summary: e.titre, description: e.description ?? undefined, location: e.lieu ?? undefined, start: { date: day(e.debut) }, end: { date: day(new Date(e.debut.getTime() + 86400_000)) } }
    : { summary: e.titre, description: e.description ?? undefined, location: e.lieu ?? undefined, start: { dateTime: e.debut.toISOString(), timeZone: "Europe/Paris" }, end: { dateTime: (e.fin ?? new Date(e.debut.getTime() + 3600_000)).toISOString(), timeZone: "Europe/Paris" } };
}

/** Crée ou met à jour l'événement `cle` dans l'agenda de `userId`. Silencieux si le membre n'a pas connecté Google. */
export async function upsertAgendaEvent(userId: string, cle: string, e: Ev) {
  const client = await userGoogleClient(userId);
  if (!client) return false;
  const existing = await prisma.agendaEvent.findUnique({ where: { userId_cle: { userId, cle } } });
  try {
    if (existing) {
      await client.request({ url: `${API}/${existing.googleEventId}`, method: "PUT", data: body(e) });
      await prisma.agendaEvent.update({ where: { id: existing.id }, data: { updatedAt: new Date() } });
    } else {
      const res = await client.request<{ id: string }>({ url: API, method: "POST", data: body(e) });
      await prisma.agendaEvent.create({ data: { userId, cle, googleEventId: res.data.id } });
    }
    return true;
  } catch (err) {
    const st = (err as { response?: { status?: number } }).response?.status;
    if (existing && (st === 404 || st === 410)) { await prisma.agendaEvent.delete({ where: { id: existing.id } }); return upsertAgendaEvent(userId, cle, e); } // supprimé côté Google : on recrée
    throw err;
  }
}

export async function deleteAgendaEvent(userId: string, cle: string) {
  const existing = await prisma.agendaEvent.findUnique({ where: { userId_cle: { userId, cle } } });
  if (!existing) return;
  const client = await userGoogleClient(userId);
  if (client) await client.request({ url: `${API}/${existing.googleEventId}`, method: "DELETE" }).catch(() => null);
  await prisma.agendaEvent.delete({ where: { id: existing.id } });
}

/** Pousse dans l'agenda du membre tous ses RDV à venir et les échéances de ses sites ; retire ce qui n'a plus lieu d'être. */
export async function syncAgendaForUser(userId: string): Promise<{ ok: boolean; rdv: number; echeances: number; error?: string }> {
  if (!(await userGoogleClient(userId))) return { ok: false, rdv: 0, echeances: 0, error: "Compte Google non connecté." };
  const depuis = new Date(Date.now() - 86400_000);
  const [rdvs, sites] = await Promise.all([
    prisma.rendezVous.findMany({ where: { commercialId: userId, resultat: "PREVU", debut: { gte: depuis } }, include: { prospect: { select: { id: true, societe: true, telephone: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, telephone: true } } } } } }),
    prisma.site.findMany({ where: { status: "EN_CREATION", OR: [{ developpeurId: userId }, { client: { commercialId: userId } }] }, select: { id: true, name: true, deadlineV1: true, deadlineV2: true, deadlineLivraison: true, client: { select: { name: true } } } }),
  ]);
  const voulus = new Map<string, Ev>();
  for (const r of rdvs) {
    const qui = contactName(r.prospect.contacts[0]);
    voulus.set(`rdv:${r.id}`, { titre: `RDV ${qui ?? r.prospect.societe}${qui ? ` · ${r.prospect.societe}` : ""}`, debut: r.debut, fin: new Date(r.debut.getTime() + r.dureeMin * 60_000), lieu: r.lieu, description: `${r.prospect.contacts[0]?.telephone ?? r.prospect.telephone ?? ""}\n${APP}/crm/prospects/${r.prospect.id}` });
  }
  for (const s of sites) {
    const libelle = { v1: "Présentation V1", v2: "V2", livraison: "Livraison" } as const;
    for (const [k, d] of [["v1", s.deadlineV1], ["v2", s.deadlineV2], ["livraison", s.deadlineLivraison]] as const) {
      if (d && d >= depuis) voulus.set(`site:${s.id}:${k}`, { titre: `${libelle[k]} · ${s.name}`, debut: d, jour: true, description: `${s.client.name}\n${APP}/admin/sites/${s.id}` });
    }
  }
  let rdv = 0, echeances = 0;
  try {
    for (const [cle, ev] of voulus) { await upsertAgendaEvent(userId, cle, ev); if (cle.startsWith("rdv:")) rdv++; else echeances++; }
    // Plus à venir (RDV annulé, passé, échéance retirée) : on retire de l'agenda.
    const connus = await prisma.agendaEvent.findMany({ where: { userId } });
    for (const c of connus) if (!voulus.has(c.cle)) await deleteAgendaEvent(userId, c.cle);
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

/** Après un changement de RDV ou d'échéance : resynchronise les agendas concernés (jamais bloquant). */
export async function syncAgendaUsers(userIds: (string | null | undefined)[]) {
  for (const id of new Set(userIds.filter((x): x is string => !!x))) await syncAgendaForUser(id).catch((e) => console.warn("[agenda]", (e as Error).message));
}
export { PROJECT_STEPS };
