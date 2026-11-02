import { prisma } from "@/lib/prisma";
import { getReviewsProvider } from "@/lib/reviews-provider";
import { suggestReviewReply } from "@/lib/ai";
import { notifyClient } from "@/lib/notify";
import { hasModule } from "@/lib/offers";
import { journal, marquerSync } from "@/lib/connecteurs";

/** Synchronise les avis d'un site (module AVIS actif). Notifie chaque nouvel avis et prépare une réponse. */
export async function syncReviews(siteId: string, opts: { notify?: boolean } = { notify: true }) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, include: { client: { select: { name: true } } } });
  const provider = await getReviewsProvider();
  if (!provider) return { mode: "aucun" as const, created: 0, skipped: "API Business Profile non activée" as const };
  const locationId = site.googleLocationId;
  if (!locationId) return { mode: provider.mode, created: 0, skipped: "pas de fiche Google liée" as const };

  let page;
  try { page = await provider.fetchReviews(locationId); } catch (e) { await journal("business_profile", "erreur", `${site.name} : ${(e as Error).message}`); throw e; }
  const source = "GOOGLE";
  let created = 0;
  for (const r of page.reviews) {
    const existing = await prisma.review.findUnique({ where: { siteId_externalId: { siteId, externalId: r.externalId } } });
    if (existing) {
      if ((r.reply ?? null) !== existing.reply) await prisma.review.update({ where: { id: existing.id }, data: { reply: r.reply, repliedAt: r.repliedAt } });
      continue;
    }
    // Réponse gabarit (sans IA) ; une rédaction Claude se demande sur clic (proposerReponseAvis).
    const suggestedReply = r.reply ? null : await suggestReviewReply({ businessName: site.client.name, authorName: r.authorName, rating: r.rating, text: r.text });
    await prisma.review.create({ data: { siteId, source, externalId: r.externalId, authorName: r.authorName, authorPhotoUrl: r.authorPhotoUrl ?? null, rating: r.rating, text: r.text, reply: r.reply, repliedAt: r.repliedAt, suggestedReply, publishedAt: r.publishedAt } });
    created++;
    if (opts.notify && !r.reply && Date.now() - r.publishedAt.getTime() < 30 * 86400_000) {
      await notifyClient({
        clientId: site.clientId, siteId, kind: "NOUVEL_AVIS", pref: "reviews",
        title: `Nouvel avis ${r.rating}/5 de ${r.authorName}`,
        body: r.text ? r.text.slice(0, 120) : "Sans commentaire. Une réponse est prête à publier.",
        href: `/sites/${siteId}/avis`,
      });
    }
  }
  await prisma.site.update({ where: { id: siteId }, data: { reviewsSyncedAt: new Date(), reviewAverage: page.averageRating, reviewTotal: page.totalReviewCount } });
  await marquerSync("business_profile");
  return { mode: provider.mode, created };
}

/** Sur clic (client ou équipe) : réponse rédigée par Claude, sous interrupteur et plafond ; sinon le gabarit reste. */
export async function proposerReponseAvis(siteId: string, reviewId: string, userId?: string | null) {
  const [site, review] = await Promise.all([prisma.site.findUniqueOrThrow({ where: { id: siteId }, include: { client: { select: { name: true } } } }), prisma.review.findFirstOrThrow({ where: { id: reviewId, siteId } })]);
  const texte = await suggestReviewReply({ businessName: site.client.name, authorName: review.authorName, rating: review.rating, text: review.text, ia: true, userId });
  await prisma.review.update({ where: { id: review.id }, data: { suggestedReply: texte } });
  return texte;
}

/** Publie une réponse (Google ou démo) et l'enregistre. */
export async function publishReply(siteId: string, reviewId: string, text: string) {
  const [site, review] = await Promise.all([prisma.site.findUniqueOrThrow({ where: { id: siteId } }), prisma.review.findFirstOrThrow({ where: { id: reviewId, siteId } })]);
  const provider = await getReviewsProvider();
  const locationId = site.googleLocationId;
  if (!provider || !locationId || review.source !== "GOOGLE") throw new Error("Cet avis ne peut pas recevoir de réponse Google (API non activée ou fiche non liée).");
  if (review.externalId) await provider.reply(locationId, review.externalId, text);
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
