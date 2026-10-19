import { Plus, Wrench } from "lucide-react";
import { requireClientSite, changeQuota } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Timeline } from "@/components/ui/timeline";
import { CHANGE_STATUS } from "@/lib/labels";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Modifications" };

export default async function ModificationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site, client } = await requireClientSite(id);
  const [requests, history, { quota, used }] = await Promise.all([
    prisma.changeRequest.findMany({ where: { siteId: site.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.siteHistoryEntry.findMany({ where: { siteId: site.id }, orderBy: { happenedAt: "desc" } }),
    changeQuota(site.id, client.id),
  ]);
  const open = requests.filter((r) => r.status !== "TERMINEE" || !r.confirmedAt);
  const closed = requests.filter((r) => r.status === "TERMINEE" && r.confirmedAt);

  return (
    <div>
      <Button href={`/sites/${site.id}/modifications/nouvelle`} size="lg" className="w-full">
        <Plus size={18} /> Nouvelle demande
      </Button>
      {quota !== null && (
        <p className="mt-2 text-center text-xs text-text">
          {used} / {quota} demande{quota > 1 ? "s" : ""} utilisée{used > 1 ? "s" : ""} ce mois-ci
        </p>
      )}

      <SectionTitle emoji="🛠️">En cours</SectionTitle>
      {open.length === 0 ? (
        <Empty icon={Wrench} title="Aucune demande en cours" />
      ) : (
        <MoreList title="Demandes en cours" limit={5} items={open.map((r) => <RequestCard key={r.id} siteId={site.id} r={r} />)} />
      )}

      {closed.length > 0 && (
        <>
          <SectionTitle emoji="✅">Terminées</SectionTitle>
          <MoreList title="Demandes terminées" labels={closed.map((r) => r.title)} limit={5} items={closed.map((r) => <RequestCard key={r.id} siteId={site.id} r={r} />)} />
        </>
      )}

      <SectionTitle emoji="🕓">Historique du site</SectionTitle>
      {history.length === 0 ? (
        <p className="text-sm text-text">Rien pour le moment.</p>
      ) : (
        <Timeline
          items={history.map((h) => ({
            id: h.id,
            date: h.happenedAt,
            title: h.title,
            description: h.description,
            items: h.items,
            tone: h.kind === "CREATION" ? "blue" : h.kind === "MISE_EN_LIGNE" ? "green" : "neutral",
          }))}
        />
      )}
    </div>
  );
}

function RequestCard({ siteId, r }: { siteId: string; r: { id: string; title: string; status: keyof typeof CHANGE_STATUS; createdAt: Date; confirmedAt: Date | null; page: string | null } }) {
  const st = CHANGE_STATUS[r.status];
  const needsConfirm = r.status === "TERMINEE" && !r.confirmedAt;
  return (
    <Card href={`/sites/${siteId}/modifications/${r.id}`} className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-title truncate">{r.title}</p>
          <p className="text-xs text-text">{r.page ? `${r.page} · ` : ""}{timeAgo(r.createdAt)}</p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      {needsConfirm && <p className="mt-2 text-xs text-yellow">À vérifier : dites-nous si c’est bon.</p>}
    </Card>
  );
}
