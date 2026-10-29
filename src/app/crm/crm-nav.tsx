"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon, ChartColumnIcon, ChevronDownIcon, EllipsisIcon, HistoryIcon, KanbanSquareIcon, ListChecksIcon, PlusIcon, SunIcon,
  UsersIcon, VaultIcon, XIcon, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean; hint?: string };

/** Onglets principaux (barre du bas sur téléphone, en-tête sur ordinateur). */
const PRINCIPAUX: Item[] = [
  { href: "/crm", label: "Ma journée", icon: SunIcon, exact: true },
  { href: "/crm/pipeline", label: "Pipeline", icon: KanbanSquareIcon },
  { href: "/crm/prospects/nouveau", label: "Nouveau", icon: PlusIcon },
  { href: "/crm/calendrier", label: "Calendrier", icon: CalendarDaysIcon },
];
/** Vues secondaires, regroupées dans « Plus ». */
function secondaires(admin: boolean): Item[] {
  return [
    { href: "/crm/prospects", label: "Tous les prospects", icon: ListChecksIcon, exact: true, hint: "Filtres avancés, repêchage, actions en masse" },
    { href: "/crm/leads", label: "Coffre à leads", icon: VaultIcon, hint: "Générer et utiliser des listes" },
    { href: "/crm/stats", label: "Stats", icon: ChartColumnIcon, hint: "Chiffres de l’équipe et graphiques" },
    ...(admin ? [
      { href: "/crm/historique", label: "Historique", icon: HistoryIcon, hint: "Tous les échanges notés" },
      { href: "/crm/equipe", label: "Équipe", icon: UsersIcon, hint: "Comptes des commerciaux" },
    ] : []),
  ];
}

function useNav(admin: boolean) {
  const pathname = usePathname();
  const production = pathname.startsWith("/crm/production");
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname.startsWith(i.href)) || (i.href === "/crm/pipeline" && pathname.startsWith("/crm/prospects/") && !pathname.endsWith("/nouveau"));
  const plus = secondaires(admin);
  return { pathname, production, active, plus, plusActive: plus.some(active) };
}

function PlusList({ items, active, onPick }: { items: Item[]; active: (i: Item) => boolean; onPick: () => void }) {
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href} onClick={onPick} className={cn("flex items-center gap-3 rounded-card px-3 py-3", active(i) ? "bg-surface-2 text-title" : "text-text-strong hover:bg-surface-2")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"><i.icon size={17} strokeWidth={1.75} aria-hidden /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{i.label}</span>{i.hint && <span className="block truncate text-xs text-text">{i.hint}</span>}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Choix du mode + onglets (ordinateur), dans l'en-tête. Prospection et Production sont deux modes séparés. */
export function CrmNav({ admin }: { admin: boolean }) {
  const { pathname, production, active, plus, plusActive } = useNav(admin);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => { const t = setTimeout(() => setOpen(false), 0); return () => clearTimeout(t); }, [pathname]);

  return (
    <>
      <div className="flex rounded-full border border-border p-0.5 text-xs font-semibold sm:ml-2">
        <Link href="/crm" className={cn("rounded-full px-3 py-1.5", !production ? "bg-title text-bg" : "text-text hover:text-title")}>Prospection</Link>
        <Link href="/crm/production" className={cn("rounded-full px-3 py-1.5", production ? "bg-title text-bg" : "text-text hover:text-title")}>Production</Link>
      </div>
      {!production && (
        <nav className="ml-2 hidden items-center gap-0.5 sm:flex xl:gap-1" aria-label="Espace Commercial">
          {PRINCIPAUX.map((i) => (
            <Link key={i.href} href={i.href} title={i.label} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm xl:px-3", active(i) ? "bg-surface-2 text-title" : "text-text hover:text-title")}>
              <i.icon size={15} strokeWidth={1.75} aria-hidden /> <span className="hidden lg:inline">{i.label}</span>
            </Link>
          ))}
          <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm xl:px-3", plusActive || open ? "bg-surface-2 text-title" : "text-text hover:text-title")}>
              <EllipsisIcon size={15} aria-hidden /> <span className="hidden lg:inline">Plus</span> <ChevronDownIcon size={13} aria-hidden />
            </button>
            {open && (
              <div className="absolute top-full left-0 z-50 mt-2 w-72 rounded-card border border-border bg-bg p-2 shadow-2xl shadow-black/60">
                <PlusList items={plus} active={active} onPick={() => setOpen(false)} />
              </div>
            )}
          </div>
        </nav>
      )}
    </>
  );
}

/** Barre du bas sur téléphone (hors de l'en-tête : son flou d'arrière-plan piégerait la position fixe) + tiroir « Plus ». */
export function CrmBottomNav({ admin }: { admin: boolean }) {
  const { pathname, production, active, plus, plusActive } = useNav(admin);
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOpen(false), 0); return () => clearTimeout(t); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (production) return null;
  const cell = (on: boolean) => cn("flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-title" : "text-text");

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Espace Commercial">
        <ul className="grid grid-cols-5" style={{ height: "var(--nav-h)" }}>
          {PRINCIPAUX.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className={cell(active(i))}><i.icon size={21} strokeWidth={active(i) ? 2 : 1.6} aria-hidden /> {i.label}</Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setOpen(true)} className={cell(plusActive || open)} aria-expanded={open}>
              <EllipsisIcon size={21} strokeWidth={plusActive ? 2 : 1.6} aria-hidden /> Plus
            </button>
          </li>
        </ul>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 sm:hidden" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal aria-label="Plus" className="w-full rounded-t-2xl border-t border-border bg-bg p-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-sm font-semibold text-title">Plus</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="flex size-9 items-center justify-center rounded-full border border-border text-text"><XIcon size={16} /></button>
            </div>
            <PlusList items={plus} active={active} onPick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
