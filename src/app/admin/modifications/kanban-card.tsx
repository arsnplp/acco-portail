import Link from "next/link";
import { Paperclip, MessageSquare, ArrowRight, ArrowLeft } from "lucide-react";
import type { ChangeRequestStatus, Urgency } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { timeAgo } from "@/lib/format";
import { moveChange, assignChange, commentChange } from "./actions";

type R = {
  id: string; title: string; description: string; page: string | null; urgency: Urgency; status: ChangeRequestStatus;
  createdAt: Date; confirmedAt: Date | null; reopenedAt: Date | null; assigneeId: string | null;
  siteName: string; siteId: string; clientName: string; attachments: number; comments: number;
};

const NEXT: Record<ChangeRequestStatus, ChangeRequestStatus | null> = { RECUE: "EN_COURS", EN_COURS: "TERMINEE", TERMINEE: null };
const PREV: Record<ChangeRequestStatus, ChangeRequestStatus | null> = { RECUE: null, EN_COURS: "RECUE", TERMINEE: "EN_COURS" };

export function KanbanCard({ r, admins }: { r: R; admins: { id: string; name: string }[] }) {
  return (
    <Card className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-title">{r.title}</p>
          <Link href={`/admin/sites/${r.siteId}`} className="text-xs text-text hover:text-title">{r.clientName} · {r.siteName}</Link>
        </div>
        {r.urgency === "URGENTE" && <span className="shrink-0 rounded-full bg-pink px-2 py-0.5 text-[10px] font-bold text-bg">URGENT</span>}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-text">Détails</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-text-strong">{r.description}</p>
        <form action={commentChange.bind(null, r.id)} className="mt-3 flex gap-2">
          <Input name="body" placeholder="Note pour le client…" className="py-2 text-sm" />
          <button className="rounded-card border border-border px-3 text-sm text-title">OK</button>
        </form>
      </details>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{timeAgo(r.createdAt)}</span>
        {r.page && <span>{r.page}</span>}
        {r.attachments > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={12} /> {r.attachments}</span>}
        {r.comments > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {r.comments}</span>}
        {r.reopenedAt && <span className="text-pink">Rouverte</span>}
        {r.status === "TERMINEE" && (r.confirmedAt ? <span className="text-green">Confirmée</span> : <span className="text-yellow">Attente client</span>)}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <form action={assignChange.bind(null, r.id)} className="flex-1">
          <AutoSubmitSelect name="assigneeId" defaultValue={r.assigneeId ?? ""} className="py-1.5 text-xs">
            <option value="">Non attribuée</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </AutoSubmitSelect>
          <button className="sr-only" type="submit">Attribuer</button>
        </form>
        {PREV[r.status] && (
          <form action={moveChange.bind(null, r.id, PREV[r.status]!)}>
            <button aria-label="Étape précédente" className="flex size-9 items-center justify-center rounded-card border border-border text-text hover:text-title"><ArrowLeft size={16} /></button>
          </form>
        )}
        {NEXT[r.status] && (
          <form action={moveChange.bind(null, r.id, NEXT[r.status]!)}>
            <button className="flex h-9 items-center gap-1 rounded-card bg-title px-3 text-xs font-semibold text-bg">
              {NEXT[r.status] === "EN_COURS" ? "Commencer" : "Terminer"} <ArrowRight size={14} />
            </button>
          </form>
        )}
      </div>
    </Card>
  );
}
