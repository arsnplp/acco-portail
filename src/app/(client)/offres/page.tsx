import { Tag } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { SectionTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { activePromo } from "@/lib/offers";
import { OfferCard } from "./offer-card";

export const metadata = { title: "Offres" };

export default async function OffresPage() {
  const { client } = await requireClientContext();
  const [offers, sites, subs, orders] = await Promise.all([
    prisma.offer.findMany({ where: { isArchived: false }, orderBy: { order: "asc" }, include: { promotions: true } }),
    prisma.site.findMany({ where: { clientId: client.id }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findMany({ where: { clientId: client.id, status: "ACTIF" }, select: { offerId: true, siteId: true, module: true } }),
    prisma.order.findMany({ where: { clientId: client.id, status: "A_TRAITER" }, select: { offerId: true, siteId: true } }),
  ]);

  const now = new Date();
  const cards = offers.map((o) => {
    const promo = activePromo(o, now);
    const active = subs.some((s) => s.offerId === o.id || (o.module !== "NONE" && s.module === o.module));
    const pending = orders.some((x) => x.offerId === o.id);
    return { offer: { id: o.id, slug: o.slug, name: o.name, benefit: o.benefit, description: o.description, priceCents: o.priceCents, setupCents: o.setupCents, billing: o.billing, module: o.module }, promo: promo ? { price: promo.price, label: promo.promo.label, endsAt: promo.promo.endsAt } : null, active, pending };
  });
  const promoCards = cards.filter((c) => c.promo && !c.active);
  const others = cards.filter((c) => !promoCards.includes(c));
  const siteOptions = sites.filter((s) => s.status !== "SUSPENDU").map((s) => ({ id: s.id, name: s.name }));

  return (
    <Page title="Offres" subtitle="Des services pour aller plus loin avec votre site. Un clic, et on vous rappelle.">
      {cards.length === 0 && <Empty icon={Tag} title="Aucune offre pour le moment" />}
      {promoCards.length > 0 && (
        <>
          <SectionTitle emoji="🔥">En ce moment</SectionTitle>
          <div className="grid gap-3">{promoCards.map((c) => <OfferCard key={c.offer.id} {...c} sites={siteOptions} />)}</div>
        </>
      )}
      {others.length > 0 && (
        <>
          <SectionTitle emoji="✨">Nos services</SectionTitle>
          <div className="grid gap-3">{others.map((c) => <OfferCard key={c.offer.id} {...c} sites={siteOptions} />)}</div>
        </>
      )}
    </Page>
  );
}
