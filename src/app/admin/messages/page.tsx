import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card } from "@/components/ui/card";
import { Dot } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import { AutoRefresh } from "@/components/messages/auto-refresh";

export const metadata = { title: "Messages" };

export default async function InboxPage() {
  const convs = await prisma.conversation.findMany({
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
    include: { client: { select: { name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { firstName: true, role: true } } } } },
  });
  const unreadCounts = await Promise.all(
    convs.map((c) => prisma.message.count({ where: { conversationId: c.id, author: { role: "CLIENT" }, createdAt: { gt: c.teamReadAt ?? new Date(0) } } })),
  );

  return (
    <AdminPage title="Messages">
      <AutoRefresh seconds={30} />
      <div className="grid gap-2">
        {convs.map((c, i) => {
          const last = c.messages[0];
          const unread = unreadCounts[i];
          return (
            <Card key={c.id} href={`/admin/messages/${c.clientId}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate ${unread ? "font-bold text-title" : "font-medium text-title"}`}>{c.client.name}</p>
                  <p className="truncate text-sm text-text">
                    {last ? `${last.author?.role === "ADMIN" ? `${last.author.firstName ?? "Acco"} : ` : ""}${last.body || "Pièce jointe"}` : "Aucun message"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {unread > 0 && <Dot tone="pink" />}
                  {c.lastMessageAt && timeAgo(c.lastMessageAt)}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
