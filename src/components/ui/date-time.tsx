"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const base = "block w-full min-w-0 rounded-card border border-border bg-surface px-3 py-3 text-base text-title outline-none focus:border-blue";

/**
 * Heure (facultative ou non). Sur iPhone un champ heure vide est une case blanche sans repère :
 * on affiche « --:-- » et une croix pour effacer une heure facultative.
 */
export function TimeInput({ name, defaultValue = "", step = 300, required, optional, label, className }: {
  name: string; defaultValue?: string; step?: number; required?: boolean; optional?: boolean; label?: string; className?: string;
}) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className={cn("relative min-w-0", className)}>
      <input type="time" name={name} value={v} onChange={(e) => setV(e.target.value)} step={step} required={required} aria-label={label} data-vide={v ? undefined : ""} className={cn(base, "peer", optional && v && "pr-9")} />
      {!v && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted peer-focus:hidden">--:--</span>}
      {optional && v && (
        <button type="button" onClick={() => setV("")} aria-label="Retirer l’heure" className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text hover:text-title">
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}

/** Date, même rendu que l'heure (alignée à gauche, hauteur stable sur iPhone). Contrôlée si `value` est fourni. */
export function DateInput({ name, value, defaultValue, onChange, min, required, label, className }: {
  name: string; value?: string; defaultValue?: string; onChange?: (v: string) => void; min?: string; required?: boolean; label?: string; className?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const v = value ?? inner;
  return (
    <div className={cn("relative min-w-0", className)}>
      <input type="date" name={name} value={v} onChange={(e) => { setInner(e.target.value); onChange?.(e.target.value); }} min={min} required={required} aria-label={label} data-vide={v ? undefined : ""} className={cn(base, "peer")} />
      {!v && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted peer-focus:hidden">jj/mm/aaaa</span>}
    </div>
  );
}
