import { prisma } from "@/lib/prisma";
import { getReviewsProvider } from "@/lib/reviews-provider";
import { suggestReviewReply } from "@/lib/ai";
import { notifyClient } from "@/lib/notify";
import { hasModule } from "@/lib/offers";

/** Synchronise les avis d'un site (module AVIS actif). Notifie chaque nouvel avis et prépare une réponse. */
export async function syncReviews(siteId: string, opts: { notify?: boolean } = { notify: true }) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, include: { client: { select: { name: true } } } });
  const provider = await getReviewsProvider();
  const locationId = provider.mode === "google" ? site.googleLocationId : `demo/${site.siteKey}`;
  if (!locationId) return { mode: provider.mode, created: 0, skipped: "pas de fiche Google liée" as const };

  const page = await provider.fetchReviews(locationId);
  const source = provider.mode === "google" ? "GOOGLE" : "DEMO";
  let created = 0;
  for (const r of page.reviews) {
    const existing = await prisma.review.findUnique({ where: { siteId_externalId: { siteId, externalId: r.externalId } } });
    if (existing) {
      if ((r.reply ?? null) !== existing.reply) await prisma.review.update({ where: { id: existing.id }, data: { reply: r.reply, repliedAt: r.repliedAt } });
      continue;
    }
    const suggestedReply = r.reply ? null : await suggestReviewReply({ businessName: site.client.name, authorName: r.authorName, rating: r.rating, text: r.text });
    await prisma.review.create({ data: { siteId, source, externalId: r.externalId, authorName: r.authorName, authorPhotoUrl: r.authorPhotoUrl ?? null, rating: r.rating, text: r.text, reply: r.reply, repliedAt: r.repliedAt, suggestedReply, publishedAt: r.publishedAt } });
    created++;
    if (opts.notify && !r.reply && Date.now() - r.publishedAt.getTime() < 30 * 86400_000) {
      await notifyClient({
        clientId: site.clientId, siteId, kind: "NOUVEL_AVIS", pref: "reviews",
        title: `Nouvel avis ${"★".repeat(r.rating)} de ${r.authorName}`,
        body: r.text ? r.text.slice(0, 120) : "Sans commentaire. Une réponse est prête à publier.",
        href: `/sites/${siteId}/avis`,
      });
    }
  }
  await prisma.site.update({ where: { id: siteId }, data: { reviewsSyncedAt: new Date(), reviewAverage: page.averageRating, reviewTotal: page.totalReviewCount } });
  return { mode: provider.mode, created };
}

/** Publie une réponse (Google ou démo) et l'enregistre. */
export async function publishReply(siteId: string, reviewId: string, text: string) {
  const [site, review] = await Promise.all([prisma.site.findUniqueOrThrow({ where: { id: siteId } }), prisma.review.findFirstOrThrow({ where: { id: reviewId, siteId } })]);
  const provider = await getReviewsProvider();
  const locationId = provider.mode === "google" ? site.googleLocationId : `demo/${site.siteKey}`;
  if (provider.mode === "google" && (!locationId || review.source !== "GOOGLE")) throw new Error("Cet avis ne peut pas recevoir de réponse Google.");
  if (review.externalId && locationId) await provider.reply(locationId, review.externalId, text);
  return prisma.review.update({ where: { id: review.id }, data: { reply: text, repliedAt: new Date() } });
}

/** Tous les sites avec le module Avis actif. */
export async function runReviewsSync() {
  const subs = await prisma.subscription.findMany({ where: { module: "AVIS", status: "ACTIF", siteId: { not: null } }, select: { siteId: true } });
  const ids = [...new Set(subs.map((s) => s.siteId!))];
  const results = [];
  for (const id of ids) {
    try { results.push({ siteId: id, ...(await syncReviews(id)) }); } catch (e) { results.push({ siteId: id, error: (e as Error).message }); }
  }
  return results;
}

export { hasModule };

/** Données de plus de 6 h (ou jamais synchronisées). */
export function isStale(d: Date | null, hours = 6) {
  return !d || Date.now() - d.getTime() > hours * 3600_000;
}
