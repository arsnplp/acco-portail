"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Paperclip, MessageSquare, ArrowRight, ArrowLeft, GripVertical } from "lucide-react";
import type { ChangeRequestStatus, Urgency } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Dot } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { CHANGE_STATUS } from "@/lib/labels";
import { timeAgo } from "@/lib/format";
import { moveChange, assignChange, commentChange } from "./actions";
import { cn } from "@/lib/cn";

export type KanbanItem = {
  id: string; title: string; description: string; page: string | null; urgency: Urgency; status: ChangeRequestStatus;
  createdAt: string; confirmedAt: string | null; reopenedAt: string | null; assigneeId: string | null;
  siteName: string; siteId: string; clientName: string; attachments: number; comments: number;
};
type Admin = { id: string; name: string };

const COLS: ChangeRequestStatus[] = ["RECUE", "EN_COURS", "TERMINEE"];
const NEXT: Record<ChangeRequestStatus, ChangeRequestStatus | null> = { RECUE: "EN_COURS", EN_COURS: "TERMINEE", TERMINEE: null };
const PREV: Record<ChangeRequestStatus, ChangeRequestStatus | null> = { RECUE: null, EN_COURS: "RECUE", TERMINEE: "EN_COURS" };

export function KanbanBoard({ items, admins }: { items: KanbanItem[]; admins: Admin[] }) {
  const [optimistic, setOptimistic] = useOptimistic(items, (state, { id, status }: { id: string; status: ChangeRequestStatus }) => state.map((it) => (it.id === id ? { ...it, status } : it)));
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ChangeRequestStatus | null>(null);

  function move(id: string, status: ChangeRequestStatus) {
    const it = optimistic.find((x) => x.id === id);
    if (!it || it.status === status) return;
    startTransition(async () => {
      setOptimistic({ id, status });
      await moveChange(id, status);
    });
  }

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
      {COLS.map((col) => {
        const list = optimistic.filter((r) => r.status === col);
        return (
          <section
            key={col}
            className={cn("w-[85vw] shrink-0 snap-start rounded-card border border-transparent p-1 transition-colors md:w-auto", overCol === col && dragId && "border-dashed border-text bg-surface/60")}
            onDragOver={(e) => { e.preventDefault(); if (overCol !== col) setOverCol(col); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; if (id) move(id, col); setDragId(null); setOverCol(null); }}
          >
            <h2 className="mb-3 flex items-center gap-2 px-1 text-sm">
              <Dot tone={CHANGE_STATUS[col].tone} /> {CHANGE_STATUS[col].label} <span className="font-normal text-text">({list.length})</span>
            </h2>
            <div className="grid min-h-16 gap-2">
              {list.map((r) => <KanbanCard key={r.id} r={r} admins={admins} dragging={dragId === r.id} onDragStart={() => setDragId(r.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} onMove={move} />)}
              {list.length === 0 && <p className="rounded-card border border-dashed border-border p-4 text-center text-xs text-muted">{dragId ? "Déposer ici" : "Vide"}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KanbanCard({ r, admins, dragging, onDragStart, onDragEnd, onMove }: { r: KanbanItem; admins: Admin[]; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onMove: (id: string, s: ChangeRequestStatus) => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn("cursor-grab active:cursor-grabbing", dragging && "opacity-40")}
    >
      <Card className="py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            <GripVertical size={16} className="mt-1 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="font-semibold text-title">{r.title}</p>
              <Link href={`/admin/sites/${r.siteId}`} className="text-xs text-text hover:text-title">{r.clientName} · {r.siteName}</Link>
            </div>
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
          <form action={assignChange.bind(null, r.id)} className="min-w-0 flex-1">
            <Select name="assigneeId" defaultValue={r.assigneeId ?? ""} className="py-1.5 text-xs" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
              <option value="">Non attribuée</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </form>
          {PREV[r.status] && (
            <button type="button" onClick={() => onMove(r.id, PREV[r.status]!)} aria-label="Étape précédente" className="flex size-9 shrink-0 items-center justify-center rounded-card border border-border text-text hover:text-title"><ArrowLeft size={16} /></button>
          )}
          {NEXT[r.status] && (
            <button type="button" onClick={() => onMove(r.id, NEXT[r.status]!)} className="flex h-9 shrink-0 items-center gap-1 rounded-card bg-title px-3 text-xs font-semibold text-bg">
              {NEXT[r.status] === "EN_COURS" ? "Commencer" : "Terminer"} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
