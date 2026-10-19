import { Inbox, Phone, Mail, Check, Trophy, Undo2 } from "lucide-react";
import { requireClientSite, monthRange } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { CONTACT_STATUS } from "@/lib/labels";
import { timeAgo } from "@/lib/format";
import { setContactStatus } from "./actions";

export const metadata = { title: "Activité" };

export default async function ActivitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const { start, end } = monthRange();
  const [count, wonCount, requests] = await Promise.all([
    prisma.contactRequest.count({ where: { siteId: site.id, createdAt: { gte: start, lt: end } } }),
    prisma.contactRequest.count({ where: { siteId: site.id, status: "DEVENU_CLIENT", createdAt: { gte: start, lt: end } } }),
    prisma.contactRequest.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const todo = requests.filter((r) => r.status === "NOUVELLE");
  const done = requests.filter((r) => r.status !== "NOUVELLE");

  return (
    <div>
      <Card className="flex items-baseline gap-3">
        <span className="font-title text-4xl font-extrabold text-title">{count}</span>
        <span className="text-text">demande{count > 1 ? "s" : ""} de clients ce mois-ci{wonCount > 0 ? <span className="text-green"> · {wonCount} devenu{wonCount > 1 ? "s" : ""} client{wonCount > 1 ? "s" : ""}</span> : null}</span>
      </Card>

      <SectionTitle emoji="📬">À traiter {todo.length > 0 && <span className="text-sm font-normal text-text">({todo.length})</span>}</SectionTitle>
      {todo.length === 0 ? (
        <Empty icon={Inbox} title="Tout est traité" text="Les prochaines demandes envoyées depuis votre site arriveront ici." />
      ) : (
        <MoreList title="Demandes à traiter" labels={todo.map((r) => r.name)} limit={5} items={todo.map((r) => <RequestCard key={r.id} r={r} siteId={site.id} />)} />
      )}

      {done.length > 0 && (
        <>
          <SectionTitle emoji="✅">Traitées</SectionTitle>
          <MoreList title="Demandes traitées" labels={done.map((r) => r.name)} limit={5} items={done.map((r) => <RequestCard key={r.id} r={r} siteId={site.id} />)} />
        </>
      )}
    </div>
  );
}

type R = { id: string; name: string; type: string | null; createdAt: Date; status: keyof typeof CONTACT_STATUS; message: string; phone: string | null; email: string | null };

function RequestCard({ r, siteId }: { r: R; siteId: string }) {
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-card border border-border px-3 text-sm font-medium text-title hover:bg-surface-2";
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-semibold text-title">{r.name}</p><p className="text-xs text-text">{r.type ?? "Message"} · {timeAgo(r.createdAt)}</p></div>
        <Badge tone={CONTACT_STATUS[r.status].tone}>{CONTACT_STATUS[r.status].label}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-text-strong">{r.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {r.phone && <a href={`tel:${r.phone.replace(/\s/g, "")}`} className={btn}><Phone size={14} /> Appeler</a>}
        {r.email && <a href={`mailto:${r.email}`} className={btn}><Mail size={14} /> Email</a>}
        {r.status === "NOUVELLE" && (
          <>
            <form action={setContactStatus.bind(null, siteId, r.id, "TRAITEE")}><button className={btn}><Check size={14} /> Marquer traitée</button></form>
            <form action={setContactStatus.bind(null, siteId, r.id, "DEVENU_CLIENT")}><button className={`${btn} border-green/60 text-green`}><Trophy size={14} /> Devenu client</button></form>
          </>
        )}
        {r.status === "TRAITEE" && (
          <form action={setContactStatus.bind(null, siteId, r.id, "DEVENU_CLIENT")}><button className={`${btn} border-green/60 text-green`}><Trophy size={14} /> Devenu client</button></form>
        )}
        {r.status !== "NOUVELLE" && (
          <form action={setContactStatus.bind(null, siteId, r.id, "NOUVELLE")}><button className="inline-flex h-9 items-center gap-1 px-2 text-xs text-muted hover:text-title"><Undo2 size={12} /> Annuler</button></form>
        )}
      </div>
    </Card>
  );
}
