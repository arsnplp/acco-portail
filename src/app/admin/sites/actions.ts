"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isGestionnaire, requireTeam, requireGestionnaire } from "@/lib/auth";
import type { ProjectStep, SiteStatus } from "@prisma/client";
import { maybeCreateReviewPrompt } from "@/lib/review-prompt";

export type ActionState = { error?: string; ok?: boolean };

export async function updateSite(siteId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireTeam();
  const d = Object.fromEntries(formData) as Record<string, string>;
  const before = await prisma.site.findUnique({ where: { id: siteId } });
  if (!before) return { error: "Site introuvable" };

  const status = d.status as SiteStatus;
  const projectStep = d.projectStep as ProjectStep;
  const goesLive = before.status !== "EN_LIGNE" && status === "EN_LIGNE";
  const url = d.url?.trim() || null;

  // Propriété Search Console : saisie, sinon devinée depuis le domaine du site (sc-domain:exemple.fr) si Google y a accès.
  // Search Console et fiche Google : réglés par le gestionnaire seulement ; pour les autres, on garde l'existant.
  const gestion = isGestionnaire(admin);
  let searchConsoleProp = gestion ? d.searchConsoleProp?.trim() || null : before.searchConsoleProp;
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
        googleLocationId: gestion ? d.googleLocationId?.trim() || null : before.googleLocationId,
        repoUrl: d.repoUrl?.trim() || null,
        repoBranch: d.repoBranch?.trim() || null,
        repoRoot: d.repoRoot?.trim().replace(/^\/+|\/+$/g, "") || null,
        launchedAt: goesLive ? new Date() : before.launchedAt,
      },
    });
    if (goesLive) {
      await tx.siteHistoryEntry.create({ data: { siteId, kind: "MISE_EN_LIGNE", title: "Mise en ligne", authorId: admin.id, items: [] } });
      await tx.notification.create({
        data: { clientId: before.clientId, siteId, kind: "SITE_EN_LIGNE", title: "Votre site est en ligne", body: before.name, href: `/sites/${siteId}` },
      });
    }
  });
  if (goesLive) await maybeCreateReviewPrompt(before.clientId, "SITE_EN_LIGNE");
  // Première liaison à une propriété (ou propriété changée) : on récupère 12 mois et on prépare le récap du mois dernier.
  if (status === "EN_LIGNE" && searchConsoleProp && searchConsoleProp !== before.searchConsoleProp) {
    const { syncSiteMonths, activerRecapAuto } = await import("@/lib/recaps");
    const res = await syncSiteMonths(siteId, 12);
    if (res.real && res.months > 0) await activerRecapAuto(siteId);
  }

  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`, "layout");
  return { ok: true };
}

export async function addHistoryEntry(siteId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireTeam();
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
  await requireTeam();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const kind = (["LOGO", "TEXTE", "PHOTO", "AUTRE"].includes(String(formData.get("kind"))) ? formData.get("kind") : "AUTRE") as "LOGO" | "TEXTE" | "PHOTO" | "AUTRE";
  await prisma.siteAsset.create({ data: { siteId, label, kind } });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`);
}

export type SyncState = { error?: string; ok?: string };

export async function syncSearchConsole(siteId: string, _prev: SyncState, formData: FormData): Promise<SyncState> {
  await requireGestionnaire();
  const months = Math.min(24, Math.max(1, parseInt(String(formData.get("months") ?? "12"), 10) || 12));
  const { syncSiteMonths, activerRecapAuto } = await import("@/lib/recaps");
  const res = await syncSiteMonths(siteId, months);
  let recap = "";
  if (res.real && res.months > 0) recap = await activerRecapAuto(siteId);
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/resultats`);
  if (res.error) return { error: `Google a refusé : ${res.error}` };
  if (!res.real) return { error: "Chiffres de démo : Google n’est pas connecté ou la propriété Search Console du site est vide." };
  if (res.months === 0) return { error: "Google n’a renvoyé aucun mois : la propriété est-elle la bonne ?" };
  return { ok: `${res.months} mois récupérés depuis Google. Récap mensuel automatique activé. ${recap}` };
}

export async function syncReviewsAction(siteId: string) {
  await requireGestionnaire();
  const { syncReviews } = await import("@/lib/reviews");
  await syncReviews(siteId, { notify: true });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/avis`);
}

export async function checkSiteNow(siteId: string) {
  await requireTeam();
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site?.url) return;
  const { checkSite } = await import("@/lib/monitor");
  await checkSite({ id: site.id, name: site.name, url: site.url });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath("/admin/sites");
  revalidatePath(`/sites/${siteId}`, "layout");
}
