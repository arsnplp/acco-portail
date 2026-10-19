import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtPrice } from "@/lib/format";
import { activePromo, MODULE_LABEL } from "@/lib/offers";
import { OfferForm } from "./offer-form";

export const metadata = { title: "Offres" };

export default async function OffresAdminPage() {
  const offers = await prisma.offer.findMany({ orderBy: [{ isArchived: "asc" }, { order: "asc" }], include: { promotions: true, _count: { select: { subscriptions: { where: { status: "ACTIF" } }, orders: { where: { status: "A_TRAITER" } } } } } });
  return (
    <AdminPage title="Offres">
      <MoreList title="Offres" labels={offers.map((o) => o.name)} limit={5} items={offers.map((o) => {
          const promo = activePromo(o);
          return (
            <Card key={o.id} href={`/admin/offres/${o.id}`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className={`font-semibold ${o.isArchived ? "text-text line-through" : "text-title"}`}>{o.name}</p>
                <p className="text-xs text-text">
                  {promo ? <><span className="line-through">{fmtPrice(o.priceCents)}</span> {fmtPrice(promo.price)}</> : fmtPrice(o.priceCents)}{o.billing === "MENSUEL" ? " / mois" : ""}
                  {o.setupCents ? ` + ${fmtPrice(o.setupCents)}` : ""}{o.module !== "NONE" ? ` · module ${MODULE_LABEL[o.module]}` : ""} · {o._count.subscriptions} actif(s)
                </p>
              </div>
              <div className="flex gap-1">
                {o._count.orders > 0 && <Badge tone="pink">{o._count.orders} à traiter</Badge>}
                {promo && <Badge tone="yellow">Promo</Badge>}
                {o.isArchived && <Badge tone="neutral">Archivée</Badge>}
              </div>
            </Card>
          );
        })} />
      <SectionTitle emoji="➕">Nouvelle offre</SectionTitle>
      <OfferForm />
    </AdminPage>
  );
}
