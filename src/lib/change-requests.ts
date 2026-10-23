import type { ChangeRequest, ClaudeJobState, Prisma, Site } from "@prisma/client";

/**
 * Effets d'une modification terminée : entrée dans l'historique du site + notification au client.
 * Partagé entre le portail (passage manuel en « Terminée ») et le worker Claude (après la mise en ligne).
 */
export async function recordChangeDone(
  tx: Prisma.TransactionClient,
  cr: Pick<ChangeRequest, "id" | "siteId" | "title" | "page">,
  site: Pick<Site, "clientId">,
  authorId: string | null,
  when = new Date(),
) {
  await tx.siteHistoryEntry.create({
    data: { siteId: cr.siteId, kind: "INTERVENTION", title: cr.title, description: cr.page ? `Page : ${cr.page}` : null, items: [], authorId, happenedAt: when },
  });
  await tx.notification.create({
    data: { clientId: site.clientId, siteId: cr.siteId, kind: "MODIFICATION_TERMINEE", title: "Modification terminée", body: cr.title, href: `/sites/${cr.siteId}/modifications/${cr.id}` },
  });
}

/** Claude est en train de faire quelque chose : la carte ne doit pas bouger. */
export const CLAUDE_BUSY: ClaudeJobState[] = ["EN_FILE", "EN_TRAVAIL", "MISE_EN_LIGNE_DEMANDEE"];

/** Le travail de Claude est prêt (aperçu disponible) mais pas encore fusionné dans la branche publiée. */
export function claudeNeedsMerge(cr: Pick<ChangeRequest, "claudeState" | "claudePreviewUrl" | "claudeMergedAt" | "claudeBranch">) {
  return !!cr.claudeBranch && !!cr.claudePreviewUrl && !cr.claudeMergedAt && (cr.claudeState === "PRET" || cr.claudeState === "ERREUR");
}
