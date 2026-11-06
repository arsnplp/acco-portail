"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Grille de tuiles : seule la première rangée est visible, « Voir plus » déplie le reste sur place. */
export function TuilesPliables({ tuiles, parRangee = 4, className }: { tuiles: { n: string; label: string }[]; parRangee?: number; className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const visibles = ouvert ? tuiles : tuiles.slice(0, parRangee);
  const reste = tuiles.length - parRangee;
  return (
    <div className={className}>
      <div className={cn("grid grid-cols-2 gap-3", parRangee === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        {visibles.map((t) => <div key={t.label} className="rounded-card border border-border bg-surface p-4"><p className="font-title text-2xl font-extrabold text-title">{t.n}</p><p className="mt-1 text-xs text-text">{t.label}</p></div>)}
      </div>
      {reste > 0 && (
        <button type="button" onClick={() => setOuvert((o) => !o)} className="mt-2 rounded-card border border-border px-3 py-1.5 text-xs font-medium text-title hover:bg-surface">
          {ouvert ? "Voir moins" : `Voir plus (${reste} autre${reste > 1 ? "s" : ""})`}
        </button>
      )}
    </div>
  );
}
