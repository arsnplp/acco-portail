"use client";

import { useEffect, useRef, useState } from "react";
import type { ProspectStatut } from "@prisma/client";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { STATUT, TOUS_STATUTS } from "@/lib/crm";

/** Choix d'un statut présenté comme les pastilles des fiches (point de couleur + libellé). Valeur transmise au formulaire par un champ caché. */
export function StatutPicker({ name, value, onChange, abandonFirst = false, className }: { name: string; value: ProspectStatut; onChange: (s: ProspectStatut) => void; abandonFirst?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  const ordre = abandonFirst ? ["ABANDON" as const, ...TOUS_STATUTS.filter((s) => s !== "ABANDON")] : TOUS_STATUTS;
  return (
    <div ref={ref} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="flex h-12 w-full items-center justify-between gap-2 rounded-card border border-border bg-surface px-3 text-left hover:border-text">
        <Badge tone={STATUT[value].tone}>{STATUT[value].label}</Badge>
        <ChevronDownIcon size={15} className={cn("shrink-0 text-text transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className="absolute top-full left-0 z-30 mt-1 w-full min-w-48 rounded-card border border-border bg-bg p-1.5 shadow-2xl shadow-black/40">
          {ordre.map((s) => (
            <li key={s} role="option" aria-selected={s === value}>
              <button type="button" onClick={() => { onChange(s); setOpen(false); }} className={cn("flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-surface-2", s === value && "bg-surface-2")}>
                <Badge tone={STATUT[s].tone}>{STATUT[s].label}</Badge>
                {s === value && <CheckIcon size={14} className="text-title" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
