import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { KanbanBoard, type KanbanItem } from "./kanban-board";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { CLAUDE_BUSY } from "@/lib/change-requests";
import { featureEnabled } from "@/lib/settings";

export const metadata = { title: "Modifications" };

export default async function ModificationsAdminPage() {
  const [requests, admins, claudeEnabled] = await Promise.all([
    prisma.changeRequest.findMany({
      orderBy: [{ urgency: "desc" }, { completedAt: "desc" }, { createdAt: "asc" }],
      take: 300,
      include: { site: { include: { client: { select: { name: true } } } }, _count: { select: { attachments: true, comments: true } } },
    }),
    prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { firstName: "asc" } }),
    featureEnabled("feature_claude_code"),
  ]);

  const items: KanbanItem[] = requests.map((r) => ({
    id: r.id, title: r.title, description: r.description, page: r.page, urgency: r.urgency, status: r.status,
    createdAt: r.createdAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null, confirmedAt: r.confirmedAt?.toISOString() ?? null, reopenedAt: r.reopenedAt?.toISOString() ?? null, assigneeId: r.assigneeId,
    siteName: r.site.name, siteId: r.site.id, clientName: r.site.client.name, attachments: r._count.attachments, comments: r._count.comments,
    hasRepo: !!r.site.repoUrl, claudeState: r.claudeState, claudeSummary: r.claudeSummary, claudeError: r.claudeError, claudePreviewUrl: r.claudePreviewUrl,
    claudeCompareUrl: r.claudeCompareUrl, claudeFeedback: r.claudeFeedback, claudeMergedAt: r.claudeMergedAt?.toISOString() ?? null,
  }));
  const claudeBusy = items.some((i) => i.claudeState && CLAUDE_BUSY.includes(i.claudeState));

  return (
    <AdminPage title="Modifications" wide>
      <p className="-mt-3 mb-4 text-xs text-muted">Glissez une carte d’une colonne à l’autre, ou utilisez les boutons.</p>
      {claudeBusy && <AutoRefresh seconds={5} />}
      <KanbanBoard claudeEnabled={claudeEnabled} items={items} admins={admins.map((a) => ({ id: a.id, name: a.firstName ?? a.email }))} />
    </AdminPage>
  );
}
