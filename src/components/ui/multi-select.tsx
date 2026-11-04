"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type MultiOption = { value: string; label: string; group?: string };

/**
 * Filtre à choix multiples : une pastille qui ouvre une liste à cocher. Rien de coché = « tout ».
 * Dans un formulaire GET, `name` publie les valeurs cochées jointes par des virgules (`?c=id1,id2`) ;
 * contrôlé (`value` + `onChange`) dans les tableaux côté client (pipeline, production).
 */
export function MultiSelect({ name, label, options, defaultValue = [], value, onChange, className, size = "sm", exclusive = [] }: {
  name?: string; label: string; options: MultiOption[]; defaultValue?: string[]; value?: string[]; onChange?: (v: string[]) => void; className?: string; size?: "sm" | "md";
  /** Valeurs qui excluent les autres (ex. « Moi », « Tous ») : les cocher vide le reste, cocher autre chose les retire. */
  exclusive?: string[];
}) {
  const [interne, setInterne] = useState<string[]>(defaultValue);
  const choisis = value ?? interne;
  const set = (v: string[]) => { if (value === undefined) setInterne(v); onChange?.(v); };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = (v: string) => {
    if (choisis.includes(v)) return set(choisis.filter((x) => x !== v));
    if (exclusive.includes(v)) return set([v]);
    set([...choisis.filter((x) => !exclusive.includes(x)), v]);
  };
  const libelles = choisis.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean) as string[];
  const texte = libelles.length === 0 ? label : libelles.length <= 2 ? libelles.join(", ") : `${libelles[0]} +${libelles.length - 1}`;
  const visibles = useMemo(() => (q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options), [options, q]);
  const groupes = useMemo(() => { const m = new Map<string, MultiOption[]>(); for (const o of visibles) m.set(o.group ?? "", [...(m.get(o.group ?? "") ?? []), o]); return [...m.entries()]; }, [visibles]);
  const actif = choisis.length > 0;

  return (
    <div ref={ref} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={choisis.join(",")} />}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} title={libelles.join(", ") || label}
        className={cn("flex w-full items-center gap-1.5 rounded-full border bg-surface outline-none hover:border-text", size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-3.5 text-sm", actif ? "border-title font-semibold text-title" : "border-border text-title")}>
        <span className="min-w-0 flex-1 truncate text-left">{texte}</span>
        {actif && <span className="rounded-full bg-title px-1.5 text-[10px] font-bold text-bg">{choisis.length}</span>}
        <ChevronDownIcon size={13} className={cn("shrink-0 text-text transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={id} role="listbox" aria-multiselectable className="absolute top-full left-0 z-50 mt-1.5 w-64 rounded-card border border-border bg-bg p-1.5 shadow-2xl shadow-black/40">
          {options.length > 8 && (
            <label className="relative mb-1 block"><SearchIcon size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" autoFocus className="h-8 w-full rounded-full border border-border bg-surface pr-2 pl-7 text-xs text-title outline-none placeholder:text-muted" />
            </label>
          )}
          <ul className="max-h-72 overflow-y-auto">
            {groupes.map(([g, opts]) => (
              <li key={g}>
                {g && <p className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-text uppercase">{g}</p>}
                <ul>
                  {opts.map((o) => { const on = choisis.includes(o.value); return (
                    <li key={o.value}>
                      <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.value)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2", on ? "text-title" : "text-text-strong")}>
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-title bg-title text-bg" : "border-border")}>{on && <CheckIcon size={11} strokeWidth={3} />}</span>
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      </button>
                    </li>
                  ); })}
                </ul>
              </li>
            ))}
            {visibles.length === 0 && <li className="px-2 py-2 text-xs text-text">Aucun résultat.</li>}
          </ul>
          {actif && <button type="button" onClick={() => set([])} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border-t border-border py-1.5 text-xs text-text hover:text-title"><XIcon size={12} aria-hidden /> Tout décocher</button>}
        </div>
      )}
    </div>
  );
}
