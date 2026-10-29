import { prisma } from "@/lib/prisma";
import { syncProspectCalls } from "@/lib/aircall";
import { syncProspectEmails } from "@/lib/gmail";

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
