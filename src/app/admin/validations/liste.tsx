"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { deciderValidation } from "./actions";

export type ValidationItem = {
  id: string; label: string; commentaire: string | null; createdAt: string; assigne: string; pourAutrui: boolean;
  contexte: { href: string; texte: string } | null;
};

/** Liste des validations en attente, décidées en un clic (Valider) ou avec un motif (Refuser). */
export function ValidationsEnAttente({ items, compact = false }: { items: ValidationItem[]; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [faites, setFaites] = useState<string[]>([]);
  const restantes = items.filter((i) => !faites.includes(i.id));
  if (restantes.length === 0) return <p className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-text">Rien en attente de votre validation.</p>;
  const decider = (id: string, statut: "VALIDEE" | "REFUSEE") => {
    const motif = statut === "REFUSEE" ? window.prompt("Motif du refus (visible du demandeur) :") : null;
    if (statut === "REFUSEE" && motif === null) return;
    start(async () => {
      const r = await deciderValidation(id, statut, motif);
      if ("error" in r) setErreur(r.error ?? null); else setFaites((f) => [...f, id]);
    });
  };
  return (
    <div className="grid gap-2">
      {erreur && <p className="text-xs text-pink">{erreur}</p>}
      {restantes.slice(0, compact ? 5 : undefined).map((v) => (
        <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-title">{v.label}{v.pourAutrui && <span className="ml-2 align-middle"><Badge tone="violet">pour {v.assigne}</Badge></span>}</p>
            <p className="truncate text-xs text-text">
              {v.contexte && <Link href={v.contexte.href} className="underline-offset-2 hover:underline">{v.contexte.texte}</Link>}
              {v.contexte && " · "}{v.createdAt}{v.commentaire && ` · ${v.commentaire}`}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button type="button" disabled={pending} onClick={() => decider(v.id, "VALIDEE")} className="inline-flex h-8 items-center gap-1 rounded-full bg-green px-3 text-xs font-semibold text-bg disabled:opacity-50"><CheckIcon size={14} aria-hidden /> Valider</button>
            <button type="button" disabled={pending} onClick={() => decider(v.id, "REFUSEE")} className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-pink hover:text-pink disabled:opacity-50"><XIcon size={14} aria-hidden /> Refuser</button>
          </div>
        </div>
      ))}
      {compact && restantes.length > 5 && <Link href="/admin/validations" className="text-xs text-text underline-offset-2 hover:underline">Voir les {restantes.length} validations</Link>}
    </div>
  );
}
