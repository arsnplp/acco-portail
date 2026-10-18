import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo, addDays } from "@/lib/format";

export const metadata = { title: "Documents" };

export default async function DocumentsOverviewPage() {
  const [clients, awaitingClients, recentDeposits] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true, documentRequests: { where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" } } } } },
    }),
    prisma.documentRequest.findMany({ where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" }, orderBy: { createdAt: "asc" }, include: { client: { select: { id: true, name: true } } } }),
    prisma.document.findMany({ where: { uploadedByClient: true, createdAt: { gte: addDays(-14) } }, orderBy: { createdAt: "desc" }, include: { client: { select: { id: true, name: true } } } }),
  ]);

  return (
    <AdminPage title="Documents">
      <SectionTitle emoji="📤">Vous attendez des clients ({awaitingClients.length})</SectionTitle>
      {awaitingClients.length === 0 ? <p className="text-sm text-text">Aucun document attendu.</p> : (
        <div className="grid gap-2">
          {awaitingClients.map((r) => (
            <Card key={r.id} href={`/admin/clients/${r.client.id}/documents`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="truncate font-medium text-title">{r.message}</p><p className="text-xs text-text">{r.client.name} · demandé {timeAgo(r.createdAt)}</p></div>
              <Badge tone="yellow">En attente</Badge>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle emoji="📬">Déposés par les clients (14 derniers jours)</SectionTitle>
      {recentDeposits.length === 0 ? <p className="text-sm text-text">Aucun dépôt récent.</p> : (
        <div className="grid gap-2">
          {recentDeposits.map((d) => (
            <Card key={d.id} href={`/admin/clients/${d.client.id}/documents`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="truncate font-medium text-title">{d.title}</p><p className="text-xs text-text">{d.client.name} · {timeAgo(d.createdAt)}</p></div>
              <Badge tone="blue">Reçu</Badge>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle emoji="🗂️">Espace documents par client</SectionTitle>
      <div className="grid gap-2">
        {clients.map((c) => (
          <Card key={c.id} href={`/admin/clients/${c.id}/documents`} className="flex items-center justify-between gap-3 py-3">
            <div><p className="font-medium text-title">{c.name}</p><p className="text-xs text-text">{c._count.documents} document{c._count.documents > 1 ? "s" : ""}</p></div>
            {c._count.documentRequests > 0 ? <Badge tone="yellow">{c._count.documentRequests} attendu{c._count.documentRequests > 1 ? "s" : ""}</Badge> : <Badge tone="green">À jour</Badge>}
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
