"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { ChangeRequestStatus } from "@prisma/client";
import { CLAUDE_BUSY, changeDoneNotification, claudeNeedsMerge, recordChangeHistory } from "@/lib/change-requests";
import { notifyClient } from "@/lib/notify";
import { featureEnabled } from "@/lib/settings";

function revalidate(siteId: string) {
  revalidatePath("/admin/modifications");
  revalidatePath("/admin");
  revalidatePath(`/sites/${siteId}/modifications`);
}

export async function moveChange(reqId: string, status: ChangeRequestStatus) {
  const admin = await requireAdmin();
  const cr = await prisma.changeRequest.findUnique({ where: { id: reqId }, include: { site: true } });
  if (!cr || cr.status === status) return;
  // Claude travaille ou publie : on ne déplace pas la carte en même temps.
  if (cr.claudeState && CLAUDE_BUSY.includes(cr.claudeState)) return revalidate(cr.siteId);
  const now = new Date();

  // Travail de Claude validé : le worker fusionne la branche et pousse, puis enregistre l'historique et prévient le client.
  if (status === "TERMINEE" && claudeNeedsMerge(cr)) {
    await prisma.changeRequest.update({
      where: { id: reqId },
      data: { status, assigneeId: cr.assigneeId ?? admin.id, completedAt: now, confirmedAt: null, claudeState: "MISE_EN_LIGNE_DEMANDEE", claudeError: null },
    });
    return revalidate(cr.siteId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.changeRequest.update({
      where: { id: reqId },
      data: {
        status,
        assigneeId: cr.assigneeId ?? admin.id,
        startedAt: status === "EN_COURS" && !cr.startedAt ? now : cr.startedAt,
        completedAt: status === "TERMINEE" ? now : null,
        confirmedAt: status === "TERMINEE" ? null : cr.confirmedAt,
      },
    });
    if (status === "TERMINEE") await recordChangeHistory(tx, cr, admin.id, now);
  });
  if (status === "TERMINEE") await notifyClient(changeDoneNotification(cr, cr.site)).catch((e) => console.warn("[notify]", (e as Error).message));
  revalidate(cr.siteId);
}

export type ClaudeActionState = { error?: string; ok?: boolean };

/** « Confier à Claude » (ou « Refaire » avec des consignes) : met la demande dans la file du worker. */
export async function delegateToClaude(reqId: string, _prev: ClaudeActionState, formData: FormData): Promise<ClaudeActionState> {
  const admin = await requireAdmin();
  const cr = await prisma.changeRequest.findUnique({ where: { id: reqId }, include: { site: true } });
  if (!cr) return { error: "Demande introuvable" };
  if (!(await featureEnabled("feature_claude_code"))) return { error: "Activez Claude Code et sa clé API dans Paramètres." };
  if (!cr.site.repoUrl) return { error: "Renseignez le dépôt GitHub dans la fiche du site." };
  if (cr.claudeState && CLAUDE_BUSY.includes(cr.claudeState)) return { error: "Claude est déjà dessus." };
  if (cr.claudeMergedAt) return { error: "Déjà mise en ligne." };
  const feedback = String(formData.get("feedback") ?? "").trim() || null;
  await prisma.changeRequest.update({
    where: { id: reqId },
    data: {
      status: "EN_COURS",
      assigneeId: cr.assigneeId ?? admin.id,
      startedAt: cr.startedAt ?? new Date(),
      claudeState: "EN_FILE",
      claudeFeedback: feedback,
      claudeError: null,
    },
  });
  revalidate(cr.siteId);
  return { ok: true };
}

/** Retire la demande de la file tant que Claude n'a pas commencé. */
export async function cancelClaude(reqId: string) {
  await requireAdmin();
  const res = await prisma.changeRequest.updateMany({ where: { id: reqId, claudeState: "EN_FILE" }, data: { claudeState: null } });
  const cr = await prisma.changeRequest.findUnique({ where: { id: reqId }, select: { siteId: true } });
  if (res.count && cr) revalidate(cr.siteId);
}

const CLEARED = {
  claudeState: null, claudeBranch: null, claudeSummary: null, claudeFeedback: null, claudeError: null,
  claudePreviewUrl: null, claudeCompareUrl: null, claudeStartedAt: null, claudeFinishedAt: null,
} as const;

/** « Annuler la modif » : on jette le travail de Claude, la carte revient en « En cours » (le site en ligne n'a pas bougé). */
export async function discardClaudeWork(reqId: string) {
  await requireAdmin();
  const cr = await prisma.changeRequest.findUnique({ where: { id: reqId } });
  if (!cr || cr.claudeMergedAt || (cr.claudeState && CLAUDE_BUSY.includes(cr.claudeState))) return;
  await prisma.changeRequest.update({
    where: { id: reqId },
    // Une branche a été poussée : le worker la supprime avec l'aperçu, puis remet les champs à zéro.
    data: cr.claudeBranch ? { status: "EN_COURS", completedAt: null, claudeState: "ANNULATION_DEMANDEE" } : { status: "EN_COURS", completedAt: null, ...CLEARED },
  });
  revalidate(cr.siteId);
}

export async function assignChange(reqId: string, formData: FormData) {
  await requireAdmin();
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const cr = await prisma.changeRequest.update({ where: { id: reqId }, data: { assigneeId } });
  revalidate(cr.siteId);
}

export async function commentChange(reqId: string, formData: FormData) {
  const admin = await requireAdmin();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const cr = await prisma.changeRequestComment.create({ data: { changeRequestId: reqId, authorId: admin.id, body }, include: { changeRequest: true } });
  revalidate(cr.changeRequest.siteId);
}
