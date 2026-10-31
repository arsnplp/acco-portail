"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { ProjectStep } from "@prisma/client";
import { CalendarIcon, ChevronDownIcon, ExternalLinkIcon, PencilRulerIcon, UsersIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { PROJECT_STEPS } from "@/lib/labels";
import { fmtDay, initialsOf, relanceInfo } from "@/lib/crm";
import { livrerSite, moveSiteEtape } from "../sites/actions";
import { PackageCheckIcon } from "lucide-react";

export type SiteCard = {
  id: string; name: string; client: string; clientId: string; etape: ProjectStep; developpeurId: string | null; dev: string | null;
  deadline: string | null; deadlineLabel: string; depuis: string; modifs: number; preview: string | null;
};
type Dev = { id: string; name: string };

/** Kanban « Sites en cours » : une colonne par étape, échéance de l'étape sur chaque carte, filtre par développeur. */
export function ProductionBoard({ initial, devs, meId, initialDev }: { initial: SiteCard[]; devs: Dev[]; meId: string; initialDev: string }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [who, setWho] = useState(initialDev === "me" ? meId : initialDev);
  const [dragging, setDragging] = useState<SiteCard | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }));
  const visible = useMemo(() => cards.filter((c) => who === "all" || (who === "none" ? !c.developpeurId : c.developpeurId === who)), [cards, who]);

  function onEnd(e: DragEndEvent) {
    setDragging(null);
    const card = cards.find((c) => c.id === e.active.id);
    const to = e.over?.id as ProjectStep | "LIVRE" | undefined;
    if (!card || !to || to === card.etape) return;
    if (to === "LIVRE") {
      if (!confirm(`Livrer ${card.name} ? Le site passe en ligne, le client est prévenu, la carte sort du tableau.`)) return;
      setCards((cs) => cs.filter((c) => c.id !== card.id));
      start(async () => { await livrerSite(card.id); router.refresh(); });
      return;
    }
    const step = PROJECT_STEPS.find((p) => p.key === to)!;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, etape: to, deadlineLabel: step.deadline === "deadlineV1" ? "V1" : step.deadline === "deadlineV2" ? "V2" : "Livraison", depuis: new Date().toISOString() } : c)));
    start(async () => { await moveSiteEtape(card.id, to); router.refresh(); });
  }

  return (
    <div className="mt-4">
      <label className="relative mb-3 inline-flex w-full items-center sm:w-64">
        <UsersIcon size={15} className="pointer-events-none absolute left-3.5 text-text" aria-hidden />
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Développeur" className="h-10 w-full appearance-none rounded-full border border-border bg-surface pr-9 pl-9 text-sm font-semibold text-title outline-none hover:border-text">
          <option value="all">Tous les développeurs</option><option value={meId}>Mes projets</option>
          {devs.filter((d) => d.id !== meId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          <option value="none">Sans développeur</option>
        </select>
        <ChevronDownIcon size={15} className="pointer-events-none absolute right-3.5 text-text" aria-hidden />
      </label>
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragging(cards.find((c) => c.id === e.active.id) ?? null)} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {PROJECT_STEPS.map((s) => <Column key={s.key} etape={s.key} label={s.label} cards={visible.filter((c) => c.etape === s.key)} onOpen={(id) => router.push(`/admin/sites/${id}`)} />)}
        </div>
        {dragging && (
          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/95 p-3 backdrop-blur" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <LivreZone />
          </div>
        )}
        <DragOverlay dropAnimation={null}>{dragging ? <Card card={dragging} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ etape, label, cards, onOpen }: { etape: ProjectStep; label: string; cards: SiteCard[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: etape });
  const late = cards.filter((c) => c.deadline && relanceInfo(c.deadline).state === "late").length;
  return (
    <section ref={setNodeRef} className={cn("flex w-[78vw] max-w-xs shrink-0 snap-start flex-col rounded-card border bg-surface/60 lg:w-auto lg:max-w-none", isOver ? "border-text" : "border-border")}>
      <header className="flex items-center gap-2 px-3 py-2.5">
        <h2 className="truncate text-sm font-semibold text-title">{label}</h2>
        {late > 0 && <span className="rounded-full bg-pink/15 px-2 py-0.5 text-[10px] font-semibold text-pink">{late} en retard</span>}
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text tabular-nums">{cards.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2 p-2 lg:max-h-[calc(100dvh-260px)] lg:overflow-y-auto">
        {cards.map((c) => <Draggable key={c.id} card={c} onOpen={onOpen} />)}
        {cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Glissez un site ici</p>}
      </div>
    </section>
  );
}

function Draggable({ card, onOpen }: { card: SiteCard; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(card.id)} className={cn("touch-manipulation", isDragging && "opacity-30")}><Card card={card} /></div>;
}

function Card({ card, overlay }: { card: SiteCard; overlay?: boolean }) {
  const d = card.deadline ? relanceInfo(card.deadline) : null;
  return (
    <article className={cn("cursor-grab rounded-card border border-border bg-surface p-3 hover:border-text active:cursor-grabbing", overlay && "rotate-1 border-text shadow-2xl shadow-black/60")}>
      <p className="truncate font-title text-[15px] leading-tight font-semibold text-title">{card.name}</p>
      <p className="truncate text-xs text-text">{card.client}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        {d ? (
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", d.state === "late" ? "bg-pink/15 text-pink" : d.state === "today" || d.state === "soon" ? "bg-yellow/15 text-yellow" : "bg-surface-2 text-text")} title={`Deadline ${card.deadlineLabel} : ${fmtDay(card.deadline!)}`}>
            <CalendarIcon size={11} aria-hidden /> {card.deadlineLabel} · {d.state === "later" ? fmtDay(card.deadline!) : d.label}
          </span>
        ) : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">Pas de deadline {card.deadlineLabel}</span>}
        {card.modifs > 0 && <span className="flex items-center gap-1 text-text" title="Demandes de modification ouvertes"><PencilRulerIcon size={11} aria-hidden /> {card.modifs}</span>}
        {card.preview && <a href={card.preview} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-1 text-text hover:text-title" title="Prévisualisation"><ExternalLinkIcon size={11} aria-hidden /> V1</a>}
        {card.dev ? <span title={card.dev} className="ml-auto flex size-5 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-text-strong">{initialsOf(card.dev)}</span> : <span className="ml-auto text-muted" title="Sans développeur">—</span>}
      </div>
    </article>
  );
}

/** Zone « Livré » en bas de l'écran pendant un glisser : comme Gagné / Perdu dans le pipeline commercial. */
function LivreZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "LIVRE" });
  return (
    <div ref={setNodeRef} className={cn("mx-auto flex h-16 max-w-xl items-center justify-center gap-2 rounded-card border-2 border-dashed text-sm font-semibold", isOver ? "border-green bg-green/15 text-green" : "border-green/40 text-green")}>
      <PackageCheckIcon size={18} aria-hidden /> Livré : le site passe en ligne
    </div>
  );
}
