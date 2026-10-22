import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { MoreList } from "@/components/ui/more-list";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS } from "@/lib/labels";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { sites: { select: { id: true, name: true, status: true } }, memberships: { include: { user: true } }, _count: { select: { sites: true } } },
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
                  <p className="font-semibold text-title">{c.name}</p>
                  <p className="text-xs text-text">{owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""} · ${owner.email}` : "Aucun gérant"}</p>
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
