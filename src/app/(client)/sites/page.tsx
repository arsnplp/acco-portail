import { Globe } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Mes sites" };

export default async function SitesPage() {
  const { client } = await requireClientContext();
  const sites = await prisma.site.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } });

  return (
    <Page title="Mes sites">
      <div className="grid gap-3">
        {sites.map((s) => (
          <Card key={s.id} href={`/sites/${s.id}`} className="p-0 overflow-hidden">
            <div className="aspect-[16/9] bg-surface-2 border-b border-border flex items-center justify-center">
              {s.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.screenshotUrl} alt="" className="size-full object-cover" />
              ) : (
                <Globe className="text-muted" size={32} strokeWidth={1.25} />
              )}
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-title">{s.name}</p>
                <p className="text-sm text-text">{s.url ?? s.previewUrl ?? "En préparation"}</p>
              </div>
              {s.status === "EN_LIGNE" ? <Badge tone="green">En ligne</Badge> : <Badge tone="yellow">En création</Badge>}
            </div>
          </Card>
        ))}
        {sites.length === 0 && <Empty icon={Globe} title="Aucun site pour le moment" />}
      </div>
    </Page>
  );
}
