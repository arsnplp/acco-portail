"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumnIcon, FolderKanbanIcon, KanbanSquareIcon, PlusIcon, SunIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const PROSPECTION: Item[] = [
  { href: "/crm", label: "Ma journée", icon: SunIcon, exact: true },
  { href: "/crm/pipeline", label: "Pipeline", icon: KanbanSquareIcon },
  { href: "/crm/prospects/nouveau", label: "Nouveau", icon: PlusIcon },
  { href: "/crm/stats", label: "Stats", icon: ChartColumnIcon },
];

function useItems(admin: boolean) {
  const pathname = usePathname();
  const production = pathname.startsWith("/crm/production");
  const items: Item[] = production
    ? [{ href: "/crm/production", label: "Production", icon: FolderKanbanIcon }]
    : [...PROSPECTION, ...(admin ? [{ href: "/crm/equipe", label: "Équipe", icon: UsersIcon }] : [])];
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname.startsWith(i.href)) || (i.href === "/crm/pipeline" && pathname.startsWith("/crm/prospects/") && !pathname.endsWith("/nouveau"));
  return { production, items, active };
}

/** Choix du mode + onglets (ordinateur), dans l'en-tête. Prospection et Production sont deux modes séparés. */
export function CrmNav({ admin }: { admin: boolean }) {
  const { production, items, active } = useItems(admin);
  return (
    <>
      <div className="flex rounded-full border border-border p-0.5 text-xs font-semibold sm:ml-2">
        <Link href="/crm" className={cn("rounded-full px-3 py-1.5", !production ? "bg-title text-bg" : "text-text hover:text-title")}>Prospection</Link>
        <Link href="/crm/production" className={cn("rounded-full px-3 py-1.5", production ? "bg-title text-bg" : "text-text hover:text-title")}>Production</Link>
      </div>
      <nav className="ml-3 hidden items-center gap-1 sm:flex" aria-label="Espace Commercial">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", active(i) ? "bg-surface-2 text-title" : "text-text hover:text-title")}>
            <i.icon size={15} strokeWidth={1.75} aria-hidden /> {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Barre du bas sur téléphone (hors de l'en-tête : son flou d'arrière-plan piégerait la position fixe). */
export function CrmBottomNav({ admin }: { admin: boolean }) {
  const { items, active } = useItems(admin);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Espace Commercial">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, height: "var(--nav-h)" }}>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium", active(i) ? "text-title" : "text-text")}>
              <i.icon size={21} strokeWidth={active(i) ? 2 : 1.6} aria-hidden /> {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
