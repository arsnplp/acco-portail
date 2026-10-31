import { Plus, StarIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { MoreList } from "@/components/ui/more-list";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FORMULE, SITE_STATUS } from "@/lib/labels";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  // Clients références épinglés en tête (appui pour les argumentaires), puis les plus récents.
  const clients = await prisma.client.findMany({
    orderBy: [{ reference: "desc" }, { createdAt: "desc" }],
    include: { sites: { select: { id: true, name: true, status: true } }, memberships: { include: { user: true } }, commercial: { select: { firstName: true, email: true } }, _count: { select: { sites: true } } },
  });
  return (
    <AdminPage title="Clients" action={<Button href="/admin/clients/nouveau" size="sm"><Plus size={16} /> Nouveau client</Button>}>
      <div className="grid gap-2">
        <MoreList title="Clients" labels={clients.map((c) => c.name)} limit={5} className="grid gap-2" items={clients.map((c) => {
          const owner = c.memberships.find((m) => m.role === "OWNER")?.user;
          return (
            <Card key={c.id} href={`/admin/clients/${c.id}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-title">{c.reference && <StarIcon size={13} className="shrink-0 fill-yellow text-yellow" aria-label="Client référence" />}{c.name}{c.formule && <Badge tone={FORMULE[c.formule].tone} className="ml-1">{FORMULE[c.formule].label}</Badge>}</p>
                  <p className="text-xs text-text">{[owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""} · ${owner.email}`.trim() : "Aucun gérant", c.commercial ? `suivi par ${c.commercial.firstName ?? c.commercial.email}` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {c.sites[0] && <Badge tone={SITE_STATUS[c.sites[0].status].tone} className="max-w-[40vw] sm:max-w-xs">{c.sites[0].name}</Badge>}
                  {c.sites.length > 1 && <Badge tone="neutral">+{c.sites.length - 1}</Badge>}
                  {c.sites.length === 0 && <Badge tone="neutral">Aucun site</Badge>}
                </div>
              </div>
            </Card>
          );
        })} />
        {clients.length === 0 && <p className="text-text">Aucun client.</p>}
      </div>
    </AdminPage>
  );
}
