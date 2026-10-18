import type { Offer, Promotion, Module } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OfferWithPromos = Offer & { promotions: Promotion[] };

/** Promo en cours (la plus avantageuse) pour une offre. */
export function activePromo(offer: OfferWithPromos, now = new Date()) {
  const live = offer.promotions.filter((p) => p.startsAt <= now && p.endsAt > now);
  if (live.length === 0) return null;
  return live.map((p) => ({ promo: p, price: promoPrice(offer.priceCents, p) })).sort((a, b) => a.price - b.price)[0];
}

export function promoPrice(priceCents: number, p: Promotion) {
  if (p.promoPriceCents != null) return p.promoPriceCents;
  if (p.percentOff != null) return Math.round(priceCents * (100 - p.percentOff) / 100);
  return priceCents;
}

/** Le site a-t-il ce module actif ? */
export async function hasModule(siteId: string, module: Module) {
  const sub = await prisma.subscription.findFirst({ where: { siteId, module, status: "ACTIF" }, select: { id: true } });
  return Boolean(sub);
}

export const MODULE_LABEL: Record<Module, string> = { NONE: "Aucun", AVIS: "Avis Google" };
