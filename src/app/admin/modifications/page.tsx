import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { KanbanCard } from "./kanban-card";
import { CHANGE_STATUS } from "@/lib/labels";
import { Dot } from "@/components/ui/badge";
import { addDays } from "@/lib/format";

export const metadata = { title: "Modifications" };

const COLS = ["RECUE", "EN_COURS", "TERMINEE"] as const;

export default async function ModificationsAdminPage() {
  const [requests, admins] = await Promise.all([
    prisma.changeRequest.findMany({
      where: { OR: [{ status: { not: "TERMINEE" } }, { completedAt: { gte: addDays(-30) } }] },
      orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
      include: { site: { include: { client: { select: { name: true } } } }, assignee: true, _count: { select: { attachments: true, comments: true } } },
    }),
    prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { firstName: "asc" } }),
  ]);

  return (
    <AdminPage title="Modifications">
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {COLS.map((col) => {
          const list = requests.filter((r) => r.status === col);
          return (
            <section key={col} className="w-[85vw] shrink-0 snap-start md:w-auto">
              <h2 className="mb-3 flex items-center gap-2 text-sm">
                <Dot tone={CHANGE_STATUS[col].tone} />
                {CHANGE_STATUS[col].label} <span className="text-text font-normal">({list.length})</span>
              </h2>
              <div className="grid gap-2">
                {list.map((r) => (
                  <KanbanCard
                    key={r.id}
                    r={{
                      id: r.id, title: r.title, description: r.description, page: r.page, urgency: r.urgency, status: r.status,
                      createdAt: r.createdAt, confirmedAt: r.confirmedAt, reopenedAt: r.reopenedAt, assigneeId: r.assigneeId,
                      siteName: r.site.name, siteId: r.site.id, clientName: r.site.client.name, attachments: r._count.attachments, comments: r._count.comments,
                    }}
                    admins={admins.map((a) => ({ id: a.id, name: a.firstName ?? a.email }))}
                  />
                ))}
                {list.length === 0 && <p className="rounded-card border border-dashed border-border p-4 text-center text-xs text-muted">Vide</p>}
              </div>
            </section>
          );
        })}
      </div>
    </AdminPage>
  );
}
