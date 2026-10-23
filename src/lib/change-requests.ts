import type { ChangeRequest, ClaudeJobState, Prisma, Site } from "@prisma/client";

/** Modification terminée : entrée dans l'historique du site (la notification au client est envoyée à part, avec notifyClient). */
export async function recordChangeHistory(
  tx: Prisma.TransactionClient,
  cr: Pick<ChangeRequest, "id" | "siteId" | "title" | "page">,
  authorId: string | null,
  when = new Date(),
) {
  await tx.siteHistoryEntry.create({
    data: { siteId: cr.siteId, kind: "INTERVENTION", title: cr.title, description: cr.page ? `Page : ${cr.page}` : null, items: [], authorId, happenedAt: when },
  });
}

/** Contenu de la notification « modification en ligne » envoyée au client. */
export function changeDoneNotification(cr: Pick<ChangeRequest, "id" | "siteId" | "title">, site: Pick<Site, "clientId">) {
  return {
    clientId: site.clientId, siteId: cr.siteId, kind: "MODIFICATION_TERMINEE" as const, pref: "changes" as const,
    title: "Votre modification est en ligne", body: cr.title, href: `/sites/${cr.siteId}/modifications/${cr.id}`,
  };
}

/** Le worker Claude (Mac) écrit l'heure de son dernier signe de vie dans Setting toutes les 30 s. */
export const WORKER_HEARTBEAT_KEY = "claude_worker_seen_at";
export const workerOnline = (seenAt: string | null | undefined) => !!seenAt && Date.now() - new Date(seenAt).getTime() < 90_000;

/** Claude est en train de faire quelque chose : la carte ne doit pas bouger. */
export const CLAUDE_BUSY: ClaudeJobState[] = ["EN_FILE", "EN_TRAVAIL", "MISE_EN_LIGNE_DEMANDEE", "ANNULATION_DEMANDEE"];

/** Le travail de Claude est prêt (aperçu disponible) mais pas encore fusionné dans la branche publiée. */
export function claudeNeedsMerge(cr: Pick<ChangeRequest, "claudeState" | "claudePreviewUrl" | "claudeMergedAt" | "claudeBranch">) {
  return !!cr.claudeBranch && !!cr.claudePreviewUrl && !cr.claudeMergedAt && (cr.claudeState === "PRET" || cr.claudeState === "ERREUR");
}
