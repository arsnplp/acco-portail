import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { addDays } from "@/lib/format";
import { KanbanBoard, type KanbanItem } from "./kanban-board";

export const metadata = { title: "Modifications" };

export default async function ModificationsAdminPage() {
  const [requests, admins] = await Promise.all([
    prisma.changeRequest.findMany({
      where: { OR: [{ status: { not: "TERMINEE" } }, { completedAt: { gte: addDays(-30) } }] },
      orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
      include: { site: { include: { client: { select: { name: true } } } }, _count: { select: { attachments: true, comments: true } } },
    }),
    prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { firstName: "asc" } }),
  ]);

  const items: KanbanItem[] = requests.map((r) => ({
    id: r.id, title: r.title, description: r.description, page: r.page, urgency: r.urgency, status: r.status,
    createdAt: r.createdAt.toISOString(), confirmedAt: r.confirmedAt?.toISOString() ?? null, reopenedAt: r.reopenedAt?.toISOString() ?? null, assigneeId: r.assigneeId,
    siteName: r.site.name, siteId: r.site.id, clientName: r.site.client.name, attachments: r._count.attachments, comments: r._count.comments,
  }));

  return (
    <AdminPage title="Modifications">
      <p className="-mt-3 mb-4 text-xs text-muted">Glissez une carte d’une colonne à l’autre, ou utilisez les boutons.</p>
      <KanbanBoard items={items} admins={admins.map((a) => ({ id: a.id, name: a.firstName ?? a.email }))} />
    </AdminPage>
  );
}
