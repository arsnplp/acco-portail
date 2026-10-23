"use client";

import { createContext, use, useActionState, useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Paperclip, MessageSquare, ArrowRight, ArrowLeft, GripVertical, Sparkles, LoaderCircle, ExternalLink, GitCompare, RotateCcw, Rocket, CircleCheck, Undo2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import type { ChangeRequestStatus, ClaudeJobState, Urgency } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Dot } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/field";
import { CHANGE_STATUS } from "@/lib/labels";
import { timeAgo } from "@/lib/format";
import { moveChange, assignChange, commentChange, delegateToClaude, cancelClaude, discardClaudeWork, type ClaudeActionState } from "./actions";

const ClaudeEnabled = createContext(false);
import { cn } from "@/lib/cn";

export type KanbanItem = {
  id: string; title: string; description: string; page: string | null; urgency: Urgency; status: ChangeRequestStatus;
  createdAt: string; completedAt: string | null; confirmedAt: string | null; reopenedAt: string | null; assigneeId: string | null;
  siteName: string; siteId: string; clientName: string; attachments: number; comments: number;
  hasRepo: boolean; claudeState: ClaudeJobState | null; claudeSummary: string | null; claudeError: string | null; claudePreviewUrl: string | null;
  claudeCompareUrl: string | null; claudeFeedback: string | null; claudeMergedAt: string | null;
};
type Admin = { id: string; name: string };

const COLS: ChangeRequestStatus[] = ["RECUE", "EN_COURS", "A_VALIDER", "TERMINEE"];
const NEXT: Record<ChangeRequestStatus, ChangeRequestStatus | null> = { RECUE: "EN_COURS", EN_COURS: "TERMINEE", A_VALIDER: "TERMINEE", TERMINEE: null };
const PREV: Record<ChangeRequestStatus, ChangeRequestStatus | null> = { RECUE: null, EN_COURS: "RECUE", A_VALIDER: "EN_COURS", TERMINEE: "EN_COURS" };
const BUSY: ClaudeJobState[] = ["EN_FILE", "EN_TRAVAIL", "MISE_EN_LIGNE_DEMANDEE", "ANNULATION_DEMANDEE"];
const isBusy = (r: KanbanItem) => !!r.claudeState && BUSY.includes(r.claudeState);

export function KanbanBoard({ items, admins, claudeEnabled = false }: { items: KanbanItem[]; admins: Admin[]; claudeEnabled?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(items, (state, { id, status }: { id: string; status: ChangeRequestStatus }) => state.map((it) => (it.id === id ? { ...it, status } : it)));
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ChangeRequestStatus | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const VISIBLE_DONE = 2;

  function move(id: string, status: ChangeRequestStatus) {
    const it = optimistic.find((x) => x.id === id);
    if (!it || it.status === status || isBusy(it)) return;
    startTransition(async () => {
      setOptimistic({ id, status });
      await moveChange(id, status);
    });
  }

  return (
    <ClaudeEnabled value={claudeEnabled}>
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
      {COLS.map((col) => {
        const all = optimistic.filter((r) => r.status === col);
        const list = col === "TERMINEE" ? all.slice(0, VISIBLE_DONE) : all;
        return (
          <section
            key={col}
            className={cn("w-[85vw] shrink-0 snap-start rounded-card border border-transparent p-1 transition-colors md:w-auto", overCol === col && dragId && "border-dashed border-text bg-surface/60")}
            onDragOver={(e) => { e.preventDefault(); if (overCol !== col) setOverCol(col); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; if (id) move(id, col); setDragId(null); setOverCol(null); }}
          >
            <h2 className="mb-3 flex items-center gap-2 px-1 text-sm">
              <Dot tone={CHANGE_STATUS[col].tone} /> {CHANGE_STATUS[col].label} <span className="font-normal text-text">({all.length})</span>
            </h2>
            <div className="grid min-h-16 gap-2">
              {list.map((r) => <KanbanCard key={r.id} r={r} admins={admins} dragging={dragId === r.id} onDragStart={() => setDragId(r.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} onMove={move} />)}
              {list.length === 0 && <p className="rounded-card border border-dashed border-border p-4 text-center text-xs text-muted">{dragId ? "Déposer ici" : "Vide"}</p>}
              {col === "TERMINEE" && all.length > VISIBLE_DONE && (
                <button type="button" onClick={() => setShowAllDone(true)} className="rounded-card border border-border py-2.5 text-sm font-medium text-title hover:bg-surface">
                  Voir plus ({all.length - VISIBLE_DONE} autre{all.length - VISIBLE_DONE > 1 ? "s" : ""})
                </button>
              )}
            </div>
          </section>
        );
      })}
      {showAllDone && <DoneDialog items={optimistic.filter((r) => r.status === "TERMINEE")} onClose={() => setShowAllDone(false)} onMove={move} />}
    </div>
    </ClaudeEnabled>
  );
}

function DoneDialog({ items, onClose, onMove }: { items: KanbanItem[]; onClose: () => void; onMove: (id: string, s: ChangeRequestStatus) => void }) {
  const [client, setClient] = useState("");
  const clients = useMemo(() => [...new Set(items.map((i) => i.clientName))].sort((a, b) => a.localeCompare(b, "fr")), [items]);
  const sorted = useMemo(
    () => items.filter((i) => !client || i.clientName === client).sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)),
    [items, client],
  );
  const dateLabel = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  const monthOf = (iso: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(iso));
  return (
    <Dialog
      title="Terminées"
      onClose={onClose}
      header={
        <Select value={client} onChange={(e) => setClient(e.target.value)} className="w-auto max-w-[180px] py-1.5 text-sm">
          <option value="">Tous les clients</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      }
    >
          <ol className="relative ml-2 border-l border-border">
            {sorted.map((r, i) => {
              const d = r.completedAt ?? r.createdAt;
              const month = monthOf(d);
              const prev = sorted[i - 1];
              const showMonth = !prev || monthOf(prev.completedAt ?? prev.createdAt) !== month;
              return (
                <li key={r.id} className="relative pl-6 pb-5 last:pb-0">
                  {showMonth && <p className="-ml-6 mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{month}</p>}
                  <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-green ring-4 ring-bg" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-title">{r.title}</p>
                      <p className="text-xs text-text">{r.clientName} · {r.siteName}{r.page ? ` · ${r.page}` : ""} · {dateLabel(d)}</p>
                      <p className="mt-1 text-xs">{r.confirmedAt ? <span className="text-green">Confirmée par le client</span> : <span className="text-yellow">En attente de confirmation</span>}{r.reopenedAt ? <span className="text-pink"> · avait été rouverte</span> : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/sites/${r.siteId}`} className="text-xs text-text underline-offset-2 hover:underline">Fiche site</Link>
                      <button type="button" onClick={() => onMove(r.id, "EN_COURS")} className="rounded-card border border-border px-2.5 py-1.5 text-xs text-title hover:bg-surface">Rouvrir</button>
                    </div>
                  </div>
                  <details className="mt-1"><summary className="cursor-pointer text-xs text-muted">Détails</summary><p className="mt-1 whitespace-pre-wrap text-sm text-text-strong">{r.description}</p></details>
                </li>
              );
            })}
            {sorted.length === 0 && <li className="pl-6 text-sm text-text">Rien pour ce client.</li>}
          </ol>
    </Dialog>
  );
}

function KanbanCard({ r, admins, dragging, onDragStart, onDragEnd, onMove }: { r: KanbanItem; admins: Admin[]; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onMove: (id: string, s: ChangeRequestStatus) => void }) {
  return (
    <div
      draggable={!isBusy(r)}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn(isBusy(r) ? "cursor-default" : "cursor-grab active:cursor-grabbing", dragging && "opacity-40")}
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
        <ClaudePanel r={r} />
        <div className="mt-3 flex items-center gap-2">
          <form action={assignChange.bind(null, r.id)} className="min-w-0 flex-1">
            <Select name="assigneeId" defaultValue={r.assigneeId ?? ""} className="py-1.5 text-xs" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
              <option value="">Non attribuée</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </form>
          {PREV[r.status] && !isBusy(r) && (
            <button type="button" onClick={() => onMove(r.id, PREV[r.status]!)} aria-label="Étape précédente" className="flex size-9 shrink-0 items-center justify-center rounded-card border border-border text-text hover:text-title"><ArrowLeft size={16} /></button>
          )}
          {NEXT[r.status] && !isBusy(r) && (
            <button type="button" onClick={() => onMove(r.id, NEXT[r.status]!)} className="flex h-9 shrink-0 items-center gap-1 rounded-card bg-title px-3 text-xs font-semibold text-bg">
              {NEXT[r.status] === "EN_COURS" ? <>Commencer <ArrowRight size={14} /></> : r.status === "A_VALIDER" ? <>Mettre en ligne <Rocket size={14} /></> : <>Terminer <ArrowRight size={14} /></>}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Bloc Claude Code sur une carte : confier, suivre, aperçu, refaire, mise en ligne. */
function ClaudePanel({ r }: { r: KanbanItem }) {
  const enabled = use(ClaudeEnabled);
  const [redo, setRedo] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [state, action, pending] = useActionState<ClaudeActionState, FormData>(delegateToClaude.bind(null, r.id), {});
  const [, startTransition] = useTransition();
  const st = r.claudeState;
  const box = "mt-3 rounded-card border border-border bg-surface-2 p-3 text-xs";

  if (st === "EN_FILE" || st === "EN_TRAVAIL") {
    return (
      <div className={cn(box, "flex items-center justify-between gap-2")}>
        <span className="inline-flex items-center gap-2 text-title">
          <LoaderCircle size={14} className="animate-spin" />
          {st === "EN_FILE" ? "En attente du Mac…" : "Claude modifie le site…"}
        </span>
        {st === "EN_FILE" && <button type="button" onClick={() => startTransition(() => cancelClaude(r.id))} className="text-muted underline-offset-2 hover:underline">Annuler</button>}
      </div>
    );
  }
  if (st === "ANNULATION_DEMANDEE") {
    return <div className={cn(box, "inline-flex w-full items-center gap-2 text-title")}><LoaderCircle size={14} className="animate-spin" /> Annulation de la modif…</div>;
  }
  if (st === "MISE_EN_LIGNE_DEMANDEE") {
    return <div className={cn(box, "inline-flex w-full items-center gap-2 text-title")}><LoaderCircle size={14} className="animate-spin" /> Mise en ligne en cours…</div>;
  }
  if (st === "EN_LIGNE" && r.status === "TERMINEE") {
    return <p className="mt-2 inline-flex items-center gap-1 text-xs text-green"><CircleCheck size={13} /> Publiée par Claude</p>;
  }

  const ready = !!r.claudePreviewUrl && !r.claudeMergedAt;
  const showDelegate = r.status === "EN_COURS" && !ready;
  if (!showDelegate && !ready && r.status !== "A_VALIDER") return null;
  if (r.status === "A_VALIDER" && !ready && !r.claudeError) return null;

  return (
    <div className={box}>
      {r.claudeError && <p className="mb-2 text-pink">⚠ {r.claudeError}</p>}

      {ready && (
        <>
          <p className="mb-1 inline-flex items-center gap-1 font-semibold text-title"><Sparkles size={13} /> Fait par Claude</p>
          {r.claudeSummary && <p className="whitespace-pre-wrap text-text-strong">{r.claudeSummary}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={r.claudePreviewUrl!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-card bg-title px-2.5 py-1.5 font-semibold text-bg"><ExternalLink size={12} /> Aperçu</a>
            {r.claudeCompareUrl && <a href={r.claudeCompareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-card border border-border px-2.5 py-1.5 text-title"><GitCompare size={12} /> Changements</a>}
            <button type="button" onClick={() => setRedo((v) => !v)} className="inline-flex items-center gap-1 rounded-card border border-border px-2.5 py-1.5 text-title"><RotateCcw size={12} /> Refaire</button>
            <button type="button" onClick={() => setConfirmDiscard(true)} className="inline-flex items-center gap-1 rounded-card border border-pink/50 px-2.5 py-1.5 text-pink"><Undo2 size={12} /> Annuler la modif</button>
          </div>
          {confirmDiscard && (
            <div className="mt-2 rounded-card border border-pink/40 p-2">
              <p className="text-text-strong">Jeter le travail de Claude ? Le site en ligne n’est pas touché, la demande revient en « En cours ».</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => startTransition(() => discardClaudeWork(r.id))} className="rounded-card bg-pink px-2.5 py-1.5 font-semibold text-bg">Oui, annuler</button>
                <button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-card border border-border px-2.5 py-1.5 text-title">Non</button>
              </div>
            </div>
          )}
          <p className="mt-2 text-muted">L’aperçu s’ouvre sur le Mac où tourne Claude. Glissez dans « Terminée » pour mettre en ligne.</p>
        </>
      )}

      {(showDelegate || redo) && (
        <form action={action} className={cn(redo && "mt-3")}>
          {redo && <Textarea name="feedback" rows={3} placeholder="Ce qu’il faut changer…" className="mb-2 text-sm" required />}
          {!enabled ? (
            <Link href="/admin/parametres" className="text-muted underline-offset-2 hover:underline">Activez Claude Code et sa clé API dans Paramètres</Link>
          ) : r.hasRepo ? (
            <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-card bg-title px-3 py-1.5 font-semibold text-bg disabled:opacity-60">
              {pending ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />} {redo ? "Renvoyer à Claude" : "Confier à Claude"}
            </button>
          ) : (
            <Link href={`/admin/sites/${r.siteId}`} className="text-muted underline-offset-2 hover:underline">Renseignez le dépôt GitHub du site pour confier à Claude</Link>
          )}
          {state.error && <p className="mt-2 text-pink">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
