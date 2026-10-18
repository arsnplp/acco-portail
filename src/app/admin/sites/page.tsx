import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS, PROJECT_STEPS } from "@/lib/labels";

export const metadata = { title: "Sites" };

export default async function SitesAdminPage() {
  const sites = await prisma.site.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { client: { select: { name: true } }, _count: { select: { changeRequests: { where: { status: { not: "TERMINEE" } } } } } },
  });
  return (
    <AdminPage title="Sites">
      <div className="grid gap-2">
        {sites.map((s) => (
          <Card key={s.id} href={`/admin/sites/${s.id}`} className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <p className="font-semibold text-title">{s.name}</p>
              <p className="text-xs text-text">
                {s.client.name}
                {s.status === "EN_CREATION" ? ` · ${PROJECT_STEPS.find((p) => p.key === s.projectStep)?.label}` : ""}
                {s._count.changeRequests ? ` · ${s._count.changeRequests} modif ouverte(s)` : ""}
              </p>
            </div>
            <Badge tone={SITE_STATUS[s.status].tone}>{SITE_STATUS[s.status].label}</Badge>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
