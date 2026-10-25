"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import type { ProspectStatut } from "@prisma/client";
import { PhoneIcon, SearchIcon, TrophyIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { MOTIFS_PERTE, PIPELINE, STATUT, initialsOf, logoUrl, relanceInfo } from "@/lib/crm";
import { Dialog } from "@/components/ui/dialog";
import { moveProspect } from "../actions";
import { Logo } from "@/components/crm/logo";

export type CardData = {
  id: string; societe: string; statut: ProspectStatut; relanceAt: string | null; contact: string | null;
  telephone: string | null; siteWeb: string | null; cible: string | null; commercialId: string | null;
};
type Member = { id: string; name: string; avatarUrl: string | null };

const DOT: Record<string, string> = { blue: "bg-blue", neutral: "bg-text", yellow: "bg-yellow", claude: "bg-claude", pink: "bg-pink", green: "bg-green" };

export function Board({ initial, team, cibles, meId, initialFilter }: { initial: CardData[]; team: Member[]; cibles: string[]; meId: string; initialFilter: string }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [who, setWho] = useState(initialFilter === "me" ? meId : initialFilter);
  const [q, setQ] = useState("");
  const [cible, setCible] = useState("");
  const [dragging, setDragging] = useState<CardData | null>(null);
  const [lost, setLost] = useState<CardData | null>(null);
  const [, start] = useTransition();
  const members = useMemo(() => new Map(team.map((m) => [m.id, m])), [team]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const visible = cards.filter((c) =>
    (who === "all" || (who === "none" ? !c.commercialId : c.commercialId === who)) &&
    (!cible || c.cible === cible) &&
    (!q || `${c.societe} ${c.contact ?? ""} ${c.telephone ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  function move(id: string, statut: ProspectStatut, motif?: string) {
    setCards((cs) => (statut === "GAGNE" || statut === "PERDU" ? cs.filter((c) => c.id !== id) : cs.map((c) => (c.id === id ? { ...c, statut } : c))));
    start(async () => { await moveProspect(id, statut, motif); router.refresh(); });
  }

  function onEnd(e: DragEndEvent) {
    setDragging(null);
    const card = cards.find((c) => c.id === e.active.id);
    const to = e.over?.id as ProspectStatut | undefined;
    if (!card || !to || to === card.statut) return;
    if (to === "PERDU") return setLost(card);
    move(card.id, to);
  }

  const chips: { id: string; label: string }[] = [{ id: "all", label: "Tous" }, { id: meId, label: "Moi" }, ...team.filter((m) => m.id !== meId).map((m) => ({ id: m.id, label: m.name })), { id: "none", label: "Sans commercial" }];

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c.id} type="button" onClick={() => setWho(c.id)} className={cn("rounded-full border px-3 py-1.5 text-sm", who === c.id ? "border-title bg-title font-semibold text-bg" : "border-border text-text hover:text-title")}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <label className="relative flex-1 sm:w-64 sm:flex-none">
            <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Société, contact, téléphone" className="h-10 w-full rounded-full border border-border bg-surface pr-3 pl-9 text-sm text-title placeholder:text-muted outline-none focus:border-blue" />
          </label>
          <select value={cible} onChange={(e) => setCible(e.target.value)} className="h-10 max-w-40 rounded-full border border-border bg-surface px-3 text-sm text-title outline-none" aria-label="Cible">
            <option value="">Toutes cibles</option>
            {cibles.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragging(cards.find((c) => c.id === e.active.id) ?? null)} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {PIPELINE.map((s) => (
            <Column key={s} statut={s} cards={visible.filter((c) => c.statut === s)} members={members} onOpen={(id) => router.push(`/crm/prospects/${id}`)} />
          ))}
        </div>
        {dragging && (
          <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 gap-3 border-t border-border bg-bg/95 p-3 backdrop-blur" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <EndZone statut="GAGNE" />
            <EndZone statut="PERDU" />
          </div>
        )}
        <DragOverlay dropAnimation={null}>{dragging ? <Card card={dragging} member={dragging.commercialId ? members.get(dragging.commercialId) : undefined} overlay /> : null}</DragOverlay>
      </DndContext>

      {lost && (
        <Dialog title={`Perdu : ${lost.societe}`} onClose={() => setLost(null)}>
          <p className="mb-3 text-sm text-text">Pourquoi ? La fiche sort du pipeline et reste dans les archives.</p>
          <div className="grid grid-cols-2 gap-2">
            {MOTIFS_PERTE.map((m) => (
              <button key={m} type="button" onClick={() => { move(lost.id, "PERDU", m); setLost(null); }} className="rounded-card border border-border px-3 py-3 text-sm text-title hover:border-text">{m}</button>
            ))}
          </div>
        </Dialog>
      )}
    </main>
  );
}

function Column({ statut, cards, members, onOpen }: { statut: ProspectStatut; cards: CardData[]; members: Map<string, Member>; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: statut });
  const late = cards.filter((c) => relanceInfo(c.relanceAt).state === "late").length;
  return (
    <section ref={setNodeRef} className={cn("flex w-[84vw] max-w-sm shrink-0 snap-start flex-col rounded-card border bg-surface/60 lg:w-auto lg:max-w-none", isOver ? "border-text" : "border-border")}>
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn("size-2 rounded-full", DOT[STATUT[statut].tone])} />
        <h2 className="text-sm font-semibold text-title">{STATUT[statut].label}</h2>
        <span className="text-xs text-text">{cards.length}</span>
        {late > 0 && <span className="ml-auto text-[11px] font-medium text-pink">{late} en retard</span>}
      </header>
      <div className="flex min-h-24 flex-col gap-2 p-2 lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto">
        {cards.map((c) => <Draggable key={c.id} card={c} member={c.commercialId ? members.get(c.commercialId) : undefined} onOpen={onOpen} />)}
        {cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Glissez une carte ici</p>}
      </div>
    </section>
  );
}

function Draggable({ card, member, onOpen }: { card: CardData; member?: Member; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(card.id)} className={cn("touch-manipulation", isDragging && "opacity-30")}>
      <Card card={card} member={member} />
    </div>
  );
}

function Card({ card, member, overlay }: { card: CardData; member?: Member; overlay?: boolean }) {
  const r = relanceInfo(card.relanceAt);
  const logo = logoUrl(card.siteWeb);
  return (
    <article className={cn("cursor-grab rounded-card border border-border bg-surface p-3 transition-colors hover:border-text active:cursor-grabbing", overlay && "rotate-1 border-text shadow-2xl shadow-black/60")}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-xs font-semibold text-text-strong">
          <Logo src={logo} name={card.societe} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-title text-[15px] leading-tight font-semibold text-title">{card.contact ?? card.societe}</p>
          {card.contact && <p className="truncate text-xs text-text">{card.societe}</p>}
        </div>
        {card.telephone && (
          <a href={`tel:${card.telephone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} aria-label={`Appeler ${card.contact ?? card.societe}`} className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-text hover:border-green hover:text-green">
            <PhoneIcon size={14} />
          </a>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[11px]">
        <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-medium", r.state === "late" ? "bg-pink/15 text-pink" : r.state === "today" ? "bg-yellow/15 text-yellow" : "bg-surface-2 text-text")}>{r.label}</span>
        {card.cible && <span className="truncate text-muted">{card.cible}</span>}
        {member && <span title={member.name} className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-text-strong">{initialsOf(member.name)}</span>}
      </div>
    </article>
  );
}

function EndZone({ statut }: { statut: "GAGNE" | "PERDU" }) {
  const { setNodeRef, isOver } = useDroppable({ id: statut });
  const won = statut === "GAGNE";
  const Icon = won ? TrophyIcon : XCircleIcon;
  return (
    <div ref={setNodeRef} className={cn("flex h-16 items-center justify-center gap-2 rounded-card border-2 border-dashed text-sm font-semibold", won ? (isOver ? "border-green bg-green/15 text-green" : "border-green/40 text-green") : isOver ? "border-pink bg-pink/15 text-pink" : "border-pink/40 text-pink")}>
      <Icon size={18} aria-hidden /> {won ? "Gagné" : "Perdu"}
    </div>
  );
}

