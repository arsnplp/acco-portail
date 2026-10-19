import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS, PROJECT_STEPS } from "@/lib/labels";
import { Dot } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Sites" };

export default async function SitesAdminPage() {
  const sites = await prisma.site.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { client: { select: { name: true } }, healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 }, _count: { select: { changeRequests: { where: { status: { not: "TERMINEE" } } } } } },
  });
  return (
    <AdminPage title="Sites">
      <div className="grid gap-2">
        {sites.map((s) => {
          const h = s.healthChecks[0];
          const sslDays = h?.sslExpiresAt ? Math.floor((h.sslExpiresAt.getTime() - h.checkedAt.getTime()) / 86400_000) : null;
          return (
          <Card key={s.id} href={`/admin/sites/${s.id}`} className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold text-title">
                {s.status === "EN_LIGNE" && <Dot tone={!h ? "neutral" : !h.isUp ? "pink" : sslDays !== null && sslDays < 14 ? "yellow" : "green"} />}
                {s.name}
              </p>
              <p className="text-xs text-text">
                {s.client.name}
                {s.status === "EN_CREATION" ? ` · ${PROJECT_STEPS.find((p) => p.key === s.projectStep)?.label}` : ""}
                {s._count.changeRequests ? ` · ${s._count.changeRequests} modif ouverte(s)` : ""}
                {h ? ` · ${h.isUp ? `répond en ${h.responseMs} ms` : "ne répond pas"}${sslDays !== null ? ` · SSL ${sslDays} j` : ""} · vérifié ${timeAgo(h.checkedAt)}` : s.status === "EN_LIGNE" ? " · pas encore vérifié" : ""}
              </p>
            </div>
            <Badge tone={SITE_STATUS[s.status].tone}>{SITE_STATUS[s.status].label}</Badge>
          </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
