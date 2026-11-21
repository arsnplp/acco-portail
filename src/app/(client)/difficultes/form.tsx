"use client";

import { useActionState, useState } from "react";
import type { DifficulteType } from "@prisma/client";
import { cn } from "@/lib/cn";
import { Field, FormError, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DELAI_REPONSE, DIFFICULTE_TYPE } from "@/lib/difficultes-labels";
import { signalerDifficulteAction, type DifficulteState } from "./actions";

/** Formulaire volontairement court : un type, le site concerné s'il y en a plusieurs, un message. */
export function DifficulteForm({ sites, siteId }: { sites: { id: string; name: string }[]; siteId?: string | null }) {
  const [state, action] = useActionState<DifficulteState, FormData>(signalerDifficulteAction, {});
  const [type, setType] = useState<DifficulteType>("AUTRE");
  const types = Object.entries(DIFFICULTE_TYPE) as [DifficulteType, { label: string; aide: string }][];
  if (state.ok) return <div className="rounded-card border border-green/40 bg-green/10 p-4 text-sm text-green">{state.ok} Réponse attendue {DELAI_REPONSE[type]}. Vous serez prévenu ici et par email.</div>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-2">
        {types.map(([k, t]) => (
          <button key={k} type="button" onClick={() => setType(k)} aria-pressed={type === k} className={cn("rounded-card border p-3 text-left transition-colors", type === k ? "border-title bg-surface-2" : "border-border hover:border-text")}>
            <span className="block text-sm font-semibold text-title">{t.label}</span>
            <span className="block text-[11px] leading-snug text-text">{t.aide}</span>
          </button>
        ))}
      </div>
      {sites.length > 1 && <Field label="Site concerné"><Select name="siteId" defaultValue={siteId ?? ""}><option value="">— Aucun en particulier</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
      {sites.length === 1 && <input type="hidden" name="siteId" value={sites[0].id} />}
      <Textarea name="message" required maxLength={2000} placeholder="Dites-nous ce qui se passe, avec vos mots. Une capture d’écran peut être envoyée ensuite dans Messages." className="min-h-28 text-sm" />
      <p className="text-xs text-text">Réponse {DELAI_REPONSE[type]}.</p>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingLabel="Envoi…">Envoyer</SubmitButton>
    </form>
  );
}
