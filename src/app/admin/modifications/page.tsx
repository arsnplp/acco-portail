import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { KanbanBoard, type KanbanItem } from "./kanban-board";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { CLAUDE_BUSY, WORKER_HEARTBEAT_KEY, workerOnline } from "@/lib/change-requests";
import { featureEnabled } from "@/lib/settings";

export const metadata = { title: "Modifications" };

export default async function ModificationsAdminPage() {
  const [requests, admins, claudeEnabled, heartbeat] = await Promise.all([
    prisma.changeRequest.findMany({
      orderBy: [{ urgency: "desc" }, { completedAt: "desc" }, { createdAt: "asc" }],
      take: 300,
      include: { site: { include: { client: { select: { name: true } } } }, _count: { select: { attachments: true, comments: true } } },
    }),
    prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { firstName: "asc" } }),
    featureEnabled("feature_claude_code"),
    prisma.setting.findUnique({ where: { key: WORKER_HEARTBEAT_KEY } }),
  ]);
  const macOnline = workerOnline(heartbeat?.value);

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
      <div className="-mt-3 mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Glissez une carte d’une colonne à l’autre, ou utilisez les boutons.</p>
        {claudeEnabled && (
          <span title={macOnline ? "Le worker tourne sur le Mac : Claude traite les demandes." : "Le Mac est éteint, en veille ou le worker est arrêté : les demandes confiées à Claude attendront."}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${macOnline ? "border-claude/40 text-claude" : "border-border text-muted"}`}>
            <span className={`size-1.5 rounded-full ${macOnline ? "bg-claude" : "bg-muted"}`} />
            {macOnline ? "Claude prêt sur le Mac" : "Mac hors ligne"}
          </span>
        )}
      </div>
      {claudeBusy ? <AutoRefresh seconds={5} /> : claudeEnabled && <AutoRefresh seconds={60} />}
      <KanbanBoard claudeEnabled={claudeEnabled} items={items} admins={admins.map((a) => ({ id: a.id, name: a.firstName ?? a.email }))} />
    </AdminPage>
  );
}
