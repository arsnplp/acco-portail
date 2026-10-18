import { Globe, Inbox } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import { EnablePush } from "@/components/push/enable-push";

export default async function AccueilPage() {
  const { user, client } = await requireClientContext();
  const [sites, notifications] = await Promise.all([
    prisma.site.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } }),
    prisma.notification.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 20, include: { site: { select: { name: true } } } }),
  ]);

  const hour = new Date().getHours();
  const salut = hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <Page title={`${salut} ${user.firstName ?? ""}`.trim()} subtitle={client.name}>
      <EnablePush compact />

      <SectionTitle emoji="🌐">Vos sites</SectionTitle>
      <div className="grid gap-3">
        {sites.map((s) => (
          <Card key={s.id} href={`/sites/${s.id}`} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-title">{s.name}</p>
              <p className="text-sm text-text">{s.url ?? "En préparation"}</p>
            </div>
            {s.status === "EN_LIGNE" ? <Badge tone="green">En ligne</Badge> : <Badge tone="yellow">En création</Badge>}
          </Card>
        ))}
        {sites.length === 0 && <Empty icon={Globe} title="Aucun site pour le moment" />}
      </div>

      <SectionTitle emoji="🔔">Quoi de neuf</SectionTitle>
      {notifications.length === 0 ? (
        <Empty icon={Inbox} title="Rien de nouveau" text="Les demandes de clients, avis et modifications terminées apparaîtront ici." />
      ) : (
        <div className="grid gap-2">
          {notifications.map((n) => (
            <Card key={n.id} href={n.href ?? undefined} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-title">{n.title}</p>
                  {n.body && <p className="text-sm text-text mt-0.5">{n.body}</p>}
                </div>
                <span className="text-xs text-muted shrink-0">{timeAgo(n.createdAt)}</span>
              </div>
              {n.site && <p className="mt-2 text-xs text-muted">{n.site.name}</p>}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
