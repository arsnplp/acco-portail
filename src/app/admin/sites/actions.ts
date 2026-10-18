"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { ProjectStep, SiteStatus } from "@prisma/client";

export type ActionState = { error?: string; ok?: boolean };

export async function updateSite(siteId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const d = Object.fromEntries(formData) as Record<string, string>;
  const before = await prisma.site.findUnique({ where: { id: siteId } });
  if (!before) return { error: "Site introuvable" };

  const status = d.status as SiteStatus;
  const projectStep = d.projectStep as ProjectStep;
  const goesLive = before.status !== "EN_LIGNE" && status === "EN_LIGNE";

  await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: siteId },
      data: {
        name: d.name.trim(),
        url: d.url?.trim() || null,
        previewUrl: d.previewUrl?.trim() || null,
        screenshotUrl: d.screenshotUrl?.trim() || null,
        status,
        projectStep: goesLive ? "MISE_EN_LIGNE" : projectStep,
        searchConsoleProp: d.searchConsoleProp?.trim() || null,
        googleLocationId: d.googleLocationId?.trim() || null,
        launchedAt: goesLive ? new Date() : before.launchedAt,
      },
    });
    if (goesLive) {
      await tx.siteHistoryEntry.create({ data: { siteId, kind: "MISE_EN_LIGNE", title: "Mise en ligne", authorId: admin.id, items: [] } });
      await tx.notification.create({
        data: { clientId: before.clientId, siteId, kind: "SITE_EN_LIGNE", title: "Votre site est en ligne 🎉", body: before.name, href: `/sites/${siteId}` },
      });
    }
  });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

export async function addHistoryEntry(siteId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Titre requis" };
  const items = String(formData.get("items") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const kind = formData.get("kind") === "CREATION" ? "CREATION" : "INTERVENTION";
  const happenedAt = formData.get("happenedAt") ? new Date(String(formData.get("happenedAt"))) : new Date();
  await prisma.siteHistoryEntry.create({
    data: { siteId, kind, title, description: String(formData.get("description") ?? "").trim() || null, items, happenedAt, authorId: admin.id },
  });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

export async function addAssetRequest(siteId: string, formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const kind = (["LOGO", "TEXTE", "PHOTO", "AUTRE"].includes(String(formData.get("kind"))) ? formData.get("kind") : "AUTRE") as "LOGO" | "TEXTE" | "PHOTO" | "AUTRE";
  await prisma.siteAsset.create({ data: { siteId, label, kind } });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`);
}
