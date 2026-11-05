import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { whereClientsPour } from "@/lib/perimetre";
import { AdminPage } from "@/components/admin/page";
import { MoreList } from "@/components/ui/more-list";
import { Card } from "@/components/ui/card";
import { Dot } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { MegaphoneIcon } from "lucide-react";
import { teamName } from "@/lib/crm";
import { can } from "@/lib/permissions";

export const metadata = { title: "Messages" };

export default async function InboxPage() {
  const me = await requireTeam();
  const convs = await prisma.conversation.findMany({
    where: { client: whereClientsPour(me) },
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
    include: { client: { select: { name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { firstName: true, role: true } } } } },
  });
  // Signalements de la Direction : reçus (commercial attitré) et, pour la Direction, envoyés ; les traités disparaissent.
  const signalements = await prisma.signalement.findMany({
    where: { traiteAt: null, OR: [{ versId: me.id }, ...(can(me, "pilotage") ? [{ deId: me.id }] : [])] },
    orderBy: { createdAt: "desc" }, take: 50,
    include: { prospect: { select: { id: true, societe: true } }, de: { select: { firstName: true, email: true } }, vers: { select: { firstName: true, email: true } } },
  });
  const unreadCounts = await Promise.all(
    convs.map((c) => prisma.message.count({ where: { conversationId: c.id, author: { role: "CLIENT" }, createdAt: { gt: c.teamReadAt ?? new Date(0) } } })),
  );

  return (
    <AdminPage title="Messages">
      <AutoRefresh seconds={30} />
      {signalements.length > 0 && (
        <MoreList title="Demandes de la Direction sur des fiches" labels={signalements.map((s) => s.prospect.societe)} limit={5} items={signalements.map((s) => {
          const recu = s.versId === me.id, nonLu = recu && !s.luAt;
          return (
            <Card key={s.id} href={`/crm/prospects/${s.prospect.id}?signalement=${s.id}`} className="py-3">
              <div className="flex items-start gap-3">
                <MegaphoneIcon size={18} className="mt-0.5 shrink-0 text-yellow" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${nonLu ? "font-bold text-title" : "font-medium text-title"}`}>{s.prospect.societe} <span className="text-xs font-normal text-text">· {recu ? `de ${s.de ? teamName(s.de) : "la Direction"}` : `à ${s.vers ? teamName(s.vers) : "?"}`}</span></p>
                  <p className="line-clamp-2 text-sm text-text">{s.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted">{nonLu && <Dot tone="pink" />}{timeAgo(s.createdAt)}</div>
              </div>
            </Card>
          );
        })} />
      )}
      <MoreList title="Conversations" labels={convs.map((c) => c.client.name)} limit={5} items={convs.map((c, i) => {
          const last = c.messages[0];
          const unread = unreadCounts[i];
          return (
            <Card key={c.id} href={`/admin/messages/${c.clientId}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate ${unread ? "font-bold text-title" : "font-medium text-title"}`}>{c.client.name}</p>
                  <p className="truncate text-sm text-text">
                    {last ? `${(last.author?.role && last.author.role !== "CLIENT") ? `${last.author.firstName ?? "Acco"} : ` : ""}${last.body || "Pièce jointe"}` : "Aucun message"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {unread > 0 && <Dot tone="pink" />}
                  {c.lastMessageAt && timeAgo(c.lastMessageAt)}
                </div>
              </div>
            </Card>
          );
        })} />
    </AdminPage>
  );
}
