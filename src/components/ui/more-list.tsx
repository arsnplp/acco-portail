"use client";

import { useMemo, useState } from "react";
import { Dialog } from "./dialog";
import { Input } from "./field";

type Props = {
  /** Éléments déjà rendus (cartes). */
  items: React.ReactNode[];
  /** Nombre affiché avant « Voir plus ». */
  limit?: number;
  /** Titre de la fenêtre. */
  title: string;
  /** Libellés parallèles aux éléments : active une recherche dans la fenêtre. */
  labels?: string[];
  className?: string;
};

/** Liste repliée : N premiers éléments, puis « Voir plus » qui ouvre tout dans une fenêtre (avec recherche si des libellés sont fournis). */
export function MoreList({ items, limit = 3, title, labels, className = "grid gap-2" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rest = items.length - limit;
  const filtered = useMemo(() => {
    if (!labels || !q.trim()) return items;
    const n = q.trim().toLowerCase();
    return items.filter((_, i) => labels[i]?.toLowerCase().includes(n));
  }, [items, labels, q]);

  return (
    <>
      <div className={className}>
        {items.slice(0, limit)}
        {rest > 0 && (
          <button type="button" onClick={() => setOpen(true)} className="rounded-card border border-border py-2.5 text-sm font-medium text-title hover:bg-surface">
            Voir plus ({rest} autre{rest > 1 ? "s" : ""})
          </button>
        )}
      </div>
      {open && (
        <Dialog
          title={`${title} (${items.length})`}
          onClose={() => setOpen(false)}
          header={labels ? <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="w-40 py-1.5 text-sm" /> : undefined}
        >
          <div className={className}>{filtered}{filtered.length === 0 && <p className="text-sm text-text">Aucun résultat.</p>}</div>
        </Dialog>
      )}
    </>
  );
}
