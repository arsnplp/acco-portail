import { prisma } from "@/lib/prisma";
import { requireProspection } from "@/lib/auth";
import { AdminPage } from "@/components/admin/page";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtPrice } from "@/lib/format";
import { activePromo, MODULE_LABEL } from "@/lib/offers";
import { OfferForm } from "./offer-form";
import { PlusIcon } from "lucide-react";

export const metadata = { title: "Offres" };

export default async function OffresAdminPage() {
  await requireProspection();
  const all = await prisma.offer.findMany({ orderBy: [{ isArchived: "asc" }, { order: "asc" }], include: { promotions: true, parent: { select: { name: true } }, _count: { select: { subscriptions: { where: { status: "ACTIF" } }, orders: { where: { status: "A_TRAITER" } } } } } });
  // Les compléments suivent leur offre principale.
  const offers = all.filter((o) => !o.parentId).flatMap((o) => [o, ...all.filter((c) => c.parentId === o.id)]).concat(all.filter((o) => o.parentId && !all.some((p) => p.id === o.parentId)));
  const parents = all.filter((o) => !o.parentId && !o.isArchived).map((o) => ({ id: o.id, name: o.name }));
  return (
    <AdminPage title="Offres">
      <MoreList title="Offres" labels={offers.map((o) => o.name)} limit={5} items={offers.map((o) => {
          const promo = activePromo(o);
          return (
            <Card key={o.id} href={`/admin/offres/${o.id}`} className={`flex items-center justify-between gap-3 py-3 ${o.parentId ? "ml-6" : ""}`}>
              <div className="min-w-0">
                <p className={`font-semibold ${o.isArchived ? "text-text line-through" : "text-title"}`}>{o.parentId ? "↳ " : ""}{o.name}{o.parent && <span className="ml-2 text-xs font-normal text-text">complément de {o.parent.name}</span>}</p>
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
      <SectionTitle icon={PlusIcon}>Nouvelle offre</SectionTitle>
      <OfferForm parents={parents} />
    </AdminPage>
  );
}
