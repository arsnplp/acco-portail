"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { ChangeRequestStatus } from "@prisma/client";

function revalidate(siteId: string) {
  revalidatePath("/admin/modifications");
  revalidatePath("/admin");
  revalidatePath(`/sites/${siteId}/modifications`);
}

export async function moveChange(reqId: string, status: ChangeRequestStatus) {
  const admin = await requireAdmin();
  const cr = await prisma.changeRequest.findUnique({ where: { id: reqId }, include: { site: true } });
  if (!cr || cr.status === status) return;
  const now = new Date();
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
    if (status === "TERMINEE") {
      await tx.siteHistoryEntry.create({ data: { siteId: cr.siteId, kind: "INTERVENTION", title: cr.title, description: cr.page ? `Page : ${cr.page}` : null, items: [], authorId: admin.id, happenedAt: now } });
      await tx.notification.create({
        data: { clientId: cr.site.clientId, siteId: cr.siteId, kind: "MODIFICATION_TERMINEE", title: "Modification terminée", body: cr.title, href: `/sites/${cr.siteId}/modifications/${cr.id}` },
      });
    }
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
