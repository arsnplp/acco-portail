"use client";

import { createContext, use, useActionState, useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Paperclip, MessageSquare, ArrowRight, ArrowLeft, GripVertical, Sparkles, LoaderCircle, ExternalLink, GitCompare, RotateCcw, Rocket, Undo2 } from "lucide-react";
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
        <ClaudePanel r={r} onMove={onMove} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={assignChange.bind(null, r.id)} className="min-w-[8.5rem] flex-1">
            <Select name="assigneeId" defaultValue={r.assigneeId ?? ""} className="py-1.5 text-xs" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
              <option value="">Non attribuée</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </form>
          {PREV[r.status] && !isBusy(r) && (
            <button type="button" onClick={() => onMove(r.id, PREV[r.status]!)} aria-label="Étape précédente" className="flex size-9 shrink-0 items-center justify-center rounded-card border border-border text-text hover:text-title"><ArrowLeft size={16} /></button>
          )}
          {NEXT[r.status] && !isBusy(r) && (
            <button type="button" onClick={() => onMove(r.id, NEXT[r.status]!)} className={cn("flex h-9 shrink-0 items-center gap-1 rounded-card px-3 text-xs font-semibold", r.status === "A_VALIDER" ? "bg-claude text-white" : "bg-title text-bg")}>
              {NEXT[r.status] === "EN_COURS" ? <>Commencer <ArrowRight size={14} /></> : r.status === "A_VALIDER" ? <>Mettre en ligne <Rocket size={14} /></> : <>Terminer <ArrowRight size={14} /></>}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Mise en forme légère du compte rendu de Claude (paragraphes, listes, **gras**, `code`), sans HTML brut. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return <>{parts.map((p, i) => p.startsWith("**") ? <strong key={i} className="font-semibold text-title">{p.slice(2, -2).replace(/`/g, "")}</strong> : p.startsWith("`") ? <code key={i} className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em] text-title">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>)}</>;
}
function Summary({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-text-strong">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*[-*•]\s+/, "")} /></li>)}</ul>;
        return <p key={i} className="whitespace-pre-wrap"><Inline text={b} /></p>;
      })}
    </div>
  );
}
const plain = (t: string) => t.replace(/\*\*|`/g, "").replace(/^\s*[-*•]\s+/gm, "• ").replace(/\n+/g, " ").trim();

const claudeBtn = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-card bg-claude px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60";
const claudeGhost = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-card border border-claude/50 px-3 py-1.5 text-xs font-medium text-claude hover:bg-claude/10";

/** Bloc Claude Code sur une carte : confier, suivre, aperçu ; le détail s'ouvre dans une grande fenêtre. */
function ClaudePanel({ r, onMove }: { r: KanbanItem; onMove: (id: string, s: ChangeRequestStatus) => void }) {
  const enabled = use(ClaudeEnabled);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ClaudeActionState, FormData>(delegateToClaude.bind(null, r.id), {});
  const [, startTransition] = useTransition();
  const st = r.claudeState;
  const box = "mt-3 rounded-card border border-claude/30 bg-claude/[0.06] p-3 text-xs";
  const busy = (label: string, cancel?: boolean) => (
    <div className={cn(box, "flex items-center justify-between gap-2")}>
      <span className="inline-flex items-center gap-2 font-medium text-claude"><LoaderCircle size={14} className="animate-spin" /> {label}</span>
      {cancel && <button type="button" onClick={() => startTransition(() => cancelClaude(r.id))} className="text-muted underline-offset-2 hover:underline">Annuler</button>}
    </div>
  );

  if (st === "EN_FILE") return busy("En attente du Mac…", true);
  if (st === "EN_TRAVAIL") return busy("Claude modifie le site…");
  if (st === "ANNULATION_DEMANDEE") return busy("Annulation de la modif…");
  if (st === "MISE_EN_LIGNE_DEMANDEE") return busy("Mise en ligne en cours…");
  if (st === "EN_LIGNE" && r.status === "TERMINEE") return <p className="mt-2 inline-flex items-center gap-1 text-xs text-claude"><Sparkles size={12} /> Publiée par Claude</p>;

  const ready = !!r.claudePreviewUrl && !r.claudeMergedAt;
  const showDelegate = r.status === "EN_COURS" && !ready;

  if (ready) {
    return (
      <div className={box}>
        <p className="mb-1.5 inline-flex items-center gap-1 font-semibold text-claude"><Sparkles size={13} /> Fait par Claude</p>
        {r.claudeError && <p className="mb-1.5 text-pink">⚠ {r.claudeError}</p>}
        {r.claudeSummary && <p className="line-clamp-3 text-text-strong">{plain(r.claudeSummary)}</p>}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <a href={r.claudePreviewUrl!} target="_blank" rel="noreferrer" className={claudeBtn}><ExternalLink size={12} /> Aperçu</a>
          <button type="button" onClick={() => setOpen(true)} className={claudeGhost}>Lire plus</button>
        </div>
        {open && <ClaudeDialog r={r} onClose={() => setOpen(false)} onMove={onMove} />}
      </div>
    );
  }

  if (!showDelegate && !(r.status === "A_VALIDER" && r.claudeError)) return null;
  return (
    <div className={box}>
      {r.claudeError && <p className="mb-2 text-pink">⚠ {r.claudeError}</p>}
      {showDelegate && (
        <form action={action}>
          {!enabled ? (
            <Link href="/admin/parametres" className="text-claude underline-offset-2 hover:underline">Activez Claude Code dans Paramètres</Link>
          ) : r.hasRepo ? (
            <button disabled={pending} className={cn(claudeBtn, "w-full py-2")}>
              {pending ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />} Confier à Claude
            </button>
          ) : (
            <Link href={`/admin/sites/${r.siteId}`} className="text-claude underline-offset-2 hover:underline">Renseignez le dépôt GitHub du site</Link>
          )}
          {state.error && <p className="mt-2 text-pink">{state.error}</p>}
        </form>
      )}
    </div>
  );
}

/** Grande fenêtre : compte rendu complet de Claude et toutes les actions. */
function ClaudeDialog({ r, onClose, onMove }: { r: KanbanItem; onClose: () => void; onMove: (id: string, s: ChangeRequestStatus) => void }) {
  const [redo, setRedo] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [state, action, pending] = useActionState<ClaudeActionState, FormData>(delegateToClaude.bind(null, r.id), {});
  const [, startTransition] = useTransition();
  return (
    <Dialog size="lg" onClose={onClose} title={<span className="inline-flex items-center gap-2"><Sparkles size={16} className="text-claude" /> {r.title}</span>}>
      <p className="mb-4 text-xs text-text">{r.clientName} · {r.siteName}</p>
      {r.claudeError && <p className="mb-4 rounded-card border border-pink/40 p-3 text-sm text-pink">⚠ {r.claudeError}</p>}

      <div className="rounded-card border border-claude/30 bg-claude/[0.06] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-claude">Compte rendu de Claude</p>
        {r.claudeSummary ? <Summary text={r.claudeSummary} /> : <p className="text-sm text-text">Pas de compte rendu.</p>}
      </div>

      {r.claudeFeedback && <p className="mt-3 text-xs text-text">Dernière consigne envoyée : « {r.claudeFeedback} »</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={r.claudePreviewUrl!} target="_blank" rel="noreferrer" className={claudeBtn}><ExternalLink size={13} /> Aperçu</a>
        {r.claudeCompareUrl && <a href={r.claudeCompareUrl} target="_blank" rel="noreferrer" className={claudeGhost}><GitCompare size={13} /> Changements</a>}
        <button type="button" onClick={() => { setRedo((v) => !v); setConfirmDiscard(false); }} className={claudeGhost}><RotateCcw size={13} /> Refaire</button>
        <button type="button" onClick={() => { setConfirmDiscard(true); setRedo(false); }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border border-pink/50 px-3 py-1.5 text-xs font-medium text-pink hover:bg-pink/10"><Undo2 size={13} /> Annuler la modif</button>
        {r.status === "A_VALIDER" && (
          <button type="button" onClick={() => { onMove(r.id, "TERMINEE"); onClose(); }} className={cn(claudeBtn, "ml-auto")}><Rocket size={13} /> Mettre en ligne</button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">L’aperçu s’ouvre sur le Mac où tourne le worker. « Mettre en ligne » publie sur le site dans la minute.</p>

      {redo && (
        <form action={action} className="mt-4 rounded-card border border-claude/30 p-3">
          <Textarea name="feedback" rows={4} placeholder="Ce que Claude doit changer…" className="mb-2 text-sm" required autoFocus />
          <button disabled={pending} className={claudeBtn}>{pending ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />} Renvoyer à Claude</button>
          {state.error && <p className="mt-2 text-xs text-pink">{state.error}</p>}
          {state.ok && <p className="mt-2 text-xs text-claude">Renvoyé à Claude.</p>}
        </form>
      )}
      {confirmDiscard && (
        <div className="mt-4 rounded-card border border-pink/40 p-3">
          <p className="text-sm text-text-strong">Jeter le travail de Claude ? Le site en ligne n’est pas touché, la demande revient en « En cours ».</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { startTransition(() => discardClaudeWork(r.id)); onClose(); }} className="rounded-card bg-pink px-3 py-1.5 text-xs font-semibold text-bg">Oui, annuler la modif</button>
            <button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-card border border-border px-3 py-1.5 text-xs text-title">Non</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
