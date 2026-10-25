import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { contactName, fmtTime } from "@/lib/crm";
import { isGestionnaire } from "@/lib/roles";

/** Envoie les rappels arrivés à échéance (push au commercial associé). Les rappels manqués de plus de 12 h sont abandonnés. */
export async function sendDueRappels(now = new Date()) {
  const due = await prisma.prospect.findMany({
    where: { rappelAt: { lte: now }, rappelEnvoyeAt: null },
    select: { id: true, societe: true, rappelAt: true, commercialId: true, commercial: { select: { email: true, role: true } }, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true } } },
  });
  let sent = 0;
  for (const p of due) {
    const fresh = p.rappelAt && now.getTime() - p.rappelAt.getTime() < 12 * 3600_000;
    // Partie Suivi commercial : le gestionnaire du Suivi client (Arsène) n'en reçoit pas.
    if (fresh && p.commercialId && !isGestionnaire(p.commercial)) {
      const who = contactName(p.contacts[0]);
      await sendPushToUser(p.commercialId, {
        title: `Rappel ${fmtTime(p.rappelAt!)} : ${who ?? p.societe}`,
        body: who ? `Relance prévue avec ${p.societe}` : "Relance prévue",
        url: `/crm/prospects/${p.id}`,
        tag: `rappel-${p.id}`,
      }).catch((e) => console.warn("[rappels]", (e as Error).message));
      sent++;
    }
    await prisma.prospect.update({ where: { id: p.id }, data: { rappelEnvoyeAt: now } });
  }
  return { sent, total: due.length };
}

/** Vérifie les rappels chaque minute tant que le serveur tourne (lancé par instrumentation.ts). */
export function startRappelsTicker() {
  const g = globalThis as unknown as { __accoRappels?: NodeJS.Timeout };
  if (g.__accoRappels) return;
  g.__accoRappels = setInterval(() => { sendDueRappels().catch((e) => console.warn("[rappels]", (e as Error).message)); }, 60_000);
}
