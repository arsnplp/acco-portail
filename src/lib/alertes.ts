/**
 * Alerte « client sans contact » : chaque jour, un client suivi par un commercial sans aucun échange (appel, mail, RDV,
 * compte rendu) depuis plus de 60 jours déclenche une notification push au commercial et une ligne dans le flux d'activité.
 * Une alerte par client tous les 30 jours au plus.
 */
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { logActivite } from "@/lib/activite";
import { parisDay } from "@/lib/crm";

export const JOURS_SANS_CONTACT = 60;

/** Dernier contact (hors simples notes) par client : échanges rattachés au client ou à sa fiche prospect. */
export async function derniersContacts(clientIds?: string[]) {
  const clients = await prisma.client.findMany({ where: clientIds ? { id: { in: clientIds } } : {}, select: { id: true, createdAt: true, crmProspect: { select: { id: true } } } });
  const byProspect = new Map(clients.filter((c) => c.crmProspect).map((c) => [c.crmProspect!.id, c.id]));
  const [parClient, parProspect] = await Promise.all([
    prisma.echange.groupBy({ by: ["clientId"], where: { clientId: { in: clients.map((c) => c.id) }, type: { not: "NOTE" } }, _max: { date: true } }),
    prisma.echange.groupBy({ by: ["prospectId"], where: { prospectId: { in: [...byProspect.keys()] }, type: { not: "NOTE" } }, _max: { date: true } }),
  ]);
  const out = new Map<string, Date | null>(clients.map((c) => [c.id, null]));
  const bump = (id: string | null | undefined, d: Date | null) => { if (!id || !d) return; const cur = out.get(id); if (!cur || d > cur) out.set(id, d); };
  for (const g of parClient) bump(g.clientId, g._max.date);
  for (const g of parProspect) bump(byProspect.get(g.prospectId ?? ""), g._max.date);
  return out;
}

export async function alerterClientsSansContact(now = new Date()) {
  const clients = await prisma.client.findMany({ where: { commercialId: { not: null } }, select: { id: true, name: true, createdAt: true, commercialId: true, alerteContactAt: true } });
  const contacts = await derniersContacts(clients.map((c) => c.id));
  let envoyees = 0;
  for (const c of clients) {
    const dernier = contacts.get(c.id) ?? c.createdAt;
    const jours = Math.floor((now.getTime() - dernier.getTime()) / 86400_000);
    if (jours < JOURS_SANS_CONTACT) continue;
    if (c.alerteContactAt && now.getTime() - c.alerteContactAt.getTime() < 30 * 86400_000) continue;
    await sendPushToUser(c.commercialId!, { title: `${c.name} : aucun contact depuis ${jours} jours`, body: "Un appel ou un mail pour garder le lien ?", url: `/admin/clients/${c.id}`, tag: `contact-${c.id}` }).catch((e) => console.warn("[alertes]", (e as Error).message));
    await logActivite({ kind: "alerte", texte: `${c.name} : aucun contact depuis ${jours} jours`, href: `/admin/clients/${c.id}`, clientId: c.id, userId: c.commercialId });
    await prisma.client.update({ where: { id: c.id }, data: { alerteContactAt: now } });
    envoyees++;
  }
  return { envoyees, clients: clients.length };
}

/** Une fois par jour (vérifié toutes les heures tant que le serveur tourne). */
export function startAlertesTicker() {
  const g = globalThis as unknown as { __accoAlertes?: NodeJS.Timeout };
  if (g.__accoAlertes) return;
  const run = async () => {
    const jour = parisDay();
    const last = await prisma.setting.findUnique({ where: { key: "alertes_contact_jour" } });
    if (last?.value === jour) return;
    await prisma.setting.upsert({ where: { key: "alertes_contact_jour" }, create: { key: "alertes_contact_jour", value: jour }, update: { value: jour } });
    const r = await alerterClientsSansContact();
    if (r.envoyees) console.info(`[alertes] ${r.envoyees} alerte(s) client sans contact`);
  };
  setTimeout(() => run().catch((e) => console.warn("[alertes]", (e as Error).message)), 60_000);
  g.__accoAlertes = setInterval(() => run().catch((e) => console.warn("[alertes]", (e as Error).message)), 3600_000);
}
