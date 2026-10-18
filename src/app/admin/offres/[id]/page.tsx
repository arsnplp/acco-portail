import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtDate, fmtPrice } from "@/lib/format";
import { promoPrice } from "@/lib/offers";
import { OfferForm } from "../offer-form";
import { PromoForm } from "./promo-form";
import { toggleArchive, deletePromotion } from "../actions";

export default async function OfferAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id }, include: { promotions: { orderBy: { endsAt: "desc" } } } });
  if (!offer) notFound();
  const now = new Date();
  return (
    <AdminPage title={offer.name} back={{ href: "/admin/offres", label: "Offres" }} action={
      <form action={toggleArchive.bind(null, offer.id)}><SubmitButton variant="secondary" size="sm" pendingLabel="…">{offer.isArchived ? "Réactiver" : "Archiver"}</SubmitButton></form>
    }>
      <OfferForm offer={offer} />

      <SectionTitle emoji="🏷️">Promotions</SectionTitle>
      <div className="grid gap-2">
        {offer.promotions.map((p) => {
          const live = p.startsAt <= now && p.endsAt > now;
          return (
            <Card key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div><p className="font-medium text-title">{p.label}</p><p className="text-xs text-text">{p.percentOff ? `-${p.percentOff} %` : ""} → {fmtPrice(promoPrice(offer.priceCents, p))} · jusqu’au {fmtDate(p.endsAt)}</p></div>
              <div className="flex items-center gap-2">
                <Badge tone={live ? "yellow" : "neutral"}>{live ? "En cours" : p.endsAt <= now ? "Terminée" : "À venir"}</Badge>
                <form action={deletePromotion.bind(null, offer.id, p.id)}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Supprimer</SubmitButton></form>
              </div>
            </Card>
          );
        })}
        <PromoForm offerId={offer.id} />
      </div>
    </AdminPage>
  );
}
