import { prisma } from "@/lib/prisma";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addDays, fmtDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CircleCheckIcon, HourglassIcon } from "lucide-react";

export const metadata = { title: "Suivi client" };

export default async function AdminHome() {
  const in60 = addDays(60);
  const convs = await prisma.conversation.findMany({ select: { id: true, teamReadAt: true } });
  const [openChanges, ordersTodo, docsAwaited, newReferrals, unreadPerConv, ending, clients, sites] = await Promise.all([
    prisma.changeRequest.count({ where: { status: { not: "TERMINEE" } } }),
    prisma.order.count({ where: { status: "A_TRAITER" } }),
    prisma.documentRequest.count({ where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" } }),
    prisma.referral.count({ where: { status: "ENVOYEE" } }),
    Promise.all(convs.map((c) => prisma.message.count({ where: { conversationId: c.id, author: { role: "CLIENT" }, createdAt: { gt: c.teamReadAt ?? new Date(0) } } }))),
    prisma.subscription.findMany({
      where: { status: "ACTIF", commitmentEndsAt: { lte: in60, gte: new Date() } },
      orderBy: { commitmentEndsAt: "asc" },
      include: { client: { select: { id: true, name: true } }, site: { select: { name: true } } },
    }),
    prisma.client.count(),
    prisma.site.count(),
  ]);
  const unreadMessages = unreadPerConv.reduce((a, b) => a + b, 0);

  const todo: Array<{ label: string; n: number; href: string }> = [
    { label: "Modifications ouvertes", n: openChanges, href: "/admin/modifications" },
    { label: "Messages non lus", n: unreadMessages, href: "/admin/messages" },
    { label: "Commandes à traiter", n: ordersTodo, href: "/admin/commandes" },
    { label: "Nouvelles recommandations", n: newReferrals, href: "/admin/recommandations" },
    { label: "Documents attendus des clients", n: docsAwaited, href: "/admin/documents" },
  ];
  const total = todo.reduce((a, t) => a + t.n, 0);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="text-2xl">Suivi client</h1>
      <p className="mt-1 text-sm text-text">{clients} client{clients > 1 ? "s" : ""} · {sites} site{sites > 1 ? "s" : ""} · {total === 0 ? "rien à traiter, tout est à jour" : `${total} chose${total > 1 ? "s" : ""} à traiter`}</p>

      <SectionTitle icon={CircleCheckIcon}>À traiter</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {todo.map((t) => (
          <Card key={t.href} href={t.href} className={cn(t.n > 0 && "border-pink/40")}>
            <p className={cn("font-title text-3xl font-extrabold", t.n > 0 ? "text-title" : "text-muted")}>{t.n}</p>
            <p className="mt-1 text-sm text-text">{t.label}</p>
          </Card>
        ))}
      </div>

      <SectionTitle icon={HourglassIcon}>Engagements qui se terminent sous 60 jours</SectionTitle>
      {ending.length === 0 ? (
        <p className="text-sm text-text">Aucun engagement n’arrive à échéance dans les deux prochains mois.</p>
      ) : (
        <MoreList title="Engagements à échéance" labels={ending.map((s) => s.client.name)} items={ending.map((s) => {
            const days = daysUntil(s.commitmentEndsAt!);
            return (
              <Card key={s.id} href={`/admin/clients/${s.client.id}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-title">{s.client.name}</p>
                  <p className="text-xs text-text">{s.label}{s.site ? ` · ${s.site.name}` : ""} · fin le {fmtDate(s.commitmentEndsAt!)}</p>
                </div>
                <Badge tone={days <= 30 ? "pink" : "yellow"}>dans {days} j</Badge>
              </Card>
            );
          })} />
      )}
    </main>
  );
}
