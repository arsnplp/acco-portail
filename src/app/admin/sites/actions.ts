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
  const url = d.url?.trim() || null;

  // Propriété Search Console : saisie, sinon devinée depuis le domaine du site (sc-domain:exemple.fr) si Google y a accès.
  let searchConsoleProp = d.searchConsoleProp?.trim() || null;
  if (!searchConsoleProp && url && status === "EN_LIGNE") {
    const { listProperties } = await import("@/lib/google-search");
    const host = new URL(url).hostname.replace(/^www\./, "");
    const props = await listProperties();
    searchConsoleProp = props.find((p) => p === `sc-domain:${host}`) ?? props.find((p) => p.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") === host) ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: siteId },
      data: {
        name: d.name.trim(),
        url,
        previewUrl: d.previewUrl?.trim() || null,
        screenshotUrl: d.screenshotUrl?.trim() || null,
        status,
        projectStep: goesLive ? "MISE_EN_LIGNE" : projectStep,
        searchConsoleProp,
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
  // Première liaison à une propriété (ou propriété changée) : on récupère 12 mois et on prépare le récap du mois dernier.
  if (status === "EN_LIGNE" && searchConsoleProp && searchConsoleProp !== before.searchConsoleProp) {
    const { syncSiteMonth, buildRecap, previousMonth } = await import("@/lib/recaps");
    let { year, month } = previousMonth();
    for (let i = 0; i < 12; i++) { await syncSiteMonth(siteId, year, month); month -= 1; if (month === 0) { month = 12; year -= 1; } }
    const t = previousMonth();
    await buildRecap(siteId, t.year, t.month);
  }

  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`, "layout");
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

export async function syncSearchConsole(siteId: string, formData: FormData) {
  await requireAdmin();
  const months = Math.min(24, Math.max(1, parseInt(String(formData.get("months") ?? "12"), 10) || 12));
  const { syncSiteMonth, previousMonth } = await import("@/lib/recaps");
  let { year, month } = previousMonth();
  for (let i = 0; i < months; i++) {
    await syncSiteMonth(siteId, year, month);
    month -= 1; if (month === 0) { month = 12; year -= 1; }
  }
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/resultats`);
}

export async function generateRecap(siteId: string, formData: FormData) {
  await requireAdmin();
  const { buildRecap, previousMonth } = await import("@/lib/recaps");
  const t = previousMonth();
  await buildRecap(siteId, t.year, t.month, { notify: formData.get("notify") === "on" });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/resultats`);
}
