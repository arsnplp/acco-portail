import { prisma } from "@/lib/prisma";
import { syncProspectCalls } from "@/lib/aircall";
import { syncProspectEmails } from "@/lib/gmail";
import { connecteurActif, journal, marquerSync } from "@/lib/connecteurs";

/** Synchronise une fiche (appels Aircall + emails Gmail). Si `force` est faux, au plus une fois toutes les 10 minutes. */
export async function syncProspect(prospectId: string, force = false) {
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { syncAt: true } });
  if (!p) return { calls: 0, emails: 0, errors: [] as string[] };
  if (!force && p.syncAt && Date.now() - p.syncAt.getTime() < 10 * 60_000) return null;
  const errors: string[] = [];
  const [calls, mails] = await Promise.all([
    syncProspectCalls(prospectId).catch((e) => { errors.push(`Aircall : ${(e as Error).message}`); return 0; }),
    syncProspectEmails(prospectId).then((r) => { if (r.error) errors.push(r.error); return r.added; }).catch((e) => { errors.push(`Gmail : ${(e as Error).message}`); return 0; }),
  ]);
  await prisma.prospect.update({ where: { id: prospectId }, data: { syncAt: new Date() } });
  return { calls, emails: mails, errors };
}

/**
 * Synchronisation planifiée (00.8 : jamais au chargement d'une page) : toutes les 15 minutes, les emails Gmail des fiches
 * actives (prospects ouverts et clients) dont la dernière synchro date de plus d'une heure, 30 fiches par passage en rotation.
 */
export async function syncPlanifiee() {
  if (!(await connecteurActif("gmail"))) return { fiches: 0 };
  const fiches = await prisma.prospect.findMany({
    where: { AND: [{ OR: [{ statut: { notIn: ["PERDU", "ABANDON"] } }, { clientId: { not: null } }] }, { contacts: { some: { email: { not: null } } } }, { OR: [{ syncAt: null }, { syncAt: { lt: new Date(Date.now() - 3600_000) } }] }] },
    orderBy: { syncAt: { sort: "asc", nulls: "first" } }, take: 30, select: { id: true },
  });
  let n = 0;
  for (const f of fiches) {
    try { await syncProspectEmails(f.id); n++; } catch (e) { await journal("gmail", "erreur", (e as Error).message); }
    await prisma.prospect.update({ where: { id: f.id }, data: { syncAt: new Date() } }).catch(() => null);
  }
  if (n) await marquerSync("gmail");
  return { fiches: n };
}
export function startSyncTicker() {
  const g = globalThis as { __syncTicker?: NodeJS.Timeout };
  if (g.__syncTicker) return;
  const tick = () => syncPlanifiee().catch((e) => console.warn("[sync]", (e as Error).message));
  setTimeout(tick, 45_000);
  g.__syncTicker = setInterval(tick, 15 * 60_000);
}
