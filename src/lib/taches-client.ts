/** Tâches commerciales rattachées à un client (section 7) : créées depuis un RDV, un email, un appel, une maquette prête, une livraison… */
import type { TacheClientType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

export async function creerTache(t: { clientId: string; siteId?: string | null; contratId?: string | null; type?: TacheClientType; titre: string; description?: string | null; echeance?: Date | null; responsableId?: string | null; source?: string | null; createdById?: string | null; notifier?: boolean }) {
  // Idempotent sur (client, site, titre) tant qu'une tâche identique est encore à faire.
  const existe = await prisma.tacheClient.findFirst({ where: { clientId: t.clientId, siteId: t.siteId ?? null, titre: t.titre, statut: "A_FAIRE" } });
  if (existe) return existe;
  const responsableId = t.responsableId ?? (await prisma.client.findUnique({ where: { id: t.clientId }, select: { commercialId: true } }))?.commercialId ?? null;
  const tache = await prisma.tacheClient.create({ data: { clientId: t.clientId, siteId: t.siteId ?? null, contratId: t.contratId ?? null, type: t.type ?? "AUTRE", titre: t.titre, description: t.description ?? null, echeance: t.echeance ?? null, responsableId, source: t.source ?? null, createdById: t.createdById ?? null } });
  if (t.notifier !== false && responsableId) await sendPushToUser(responsableId, { title: t.titre, body: t.description ?? undefined, url: `/admin/clients/${t.clientId}`, tag: `tache-${tache.id}` }).catch(() => null);
  return tache;
}
