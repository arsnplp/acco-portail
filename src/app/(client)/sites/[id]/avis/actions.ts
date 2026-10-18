"use server";

import { revalidatePath } from "next/cache";
import { requireClientSite } from "@/lib/sites";
import { hasModule } from "@/lib/offers";
import { publishReply, syncReviews } from "@/lib/reviews";
import { prisma } from "@/lib/prisma";
import { suggestReviewReply } from "@/lib/ai";

export type ReplyState = { error?: string; ok?: boolean };

export async function publishReviewReply(siteId: string, reviewId: string, _prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const { site } = await requireClientSite(siteId);
  if (!(await hasModule(site.id, "AVIS"))) return { error: "Module Avis inactif." };
  const text = String(formData.get("reply") ?? "").trim();
  if (text.length < 5) return { error: "Écrivez au moins quelques mots." };
  try {
    await publishReply(site.id, reviewId, text.slice(0, 4000));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Publication impossible." };
  }
  revalidatePath(`/sites/${site.id}/avis`);
  return { ok: true };
}

export async function regenerateSuggestion(siteId: string, reviewId: string) {
  const { site, client } = await requireClientSite(siteId);
  const r = await prisma.review.findFirst({ where: { id: reviewId, siteId: site.id } });
  if (!r) return;
  const suggestedReply = await suggestReviewReply({ businessName: client.name, authorName: r.authorName, rating: r.rating, text: r.text });
  await prisma.review.update({ where: { id: r.id }, data: { suggestedReply } });
  revalidatePath(`/sites/${site.id}/avis`);
}

export async function refreshReviews(siteId: string) {
  const { site } = await requireClientSite(siteId);
  if (!(await hasModule(site.id, "AVIS"))) return;
  await syncReviews(site.id);
  revalidatePath(`/sites/${site.id}/avis`);
}
