"use client";

import { useActionState, useTransition } from "react";
import type { PeriodeBilan } from "@prisma/client";
import { Trash2Icon } from "lucide-react";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { INDICATEURS, type Objectifs } from "@/lib/bilans";
import { ajouterBilan, saveObjectifs, supprimerBilan, type BilanState } from "./actions";

/** Saisie des trois objectifs par indicateur : colonnes modifiables selon le rôle (soi : personnel + engagement ; Direction : fixé). */
export function ObjectifsForm({ userId, periode, debutKey, objectifs, soi, direction }: { userId: string; periode: PeriodeBilan; debutKey: string; objectifs: Objectifs; soi: boolean; direction: boolean }) {
  const [state, action] = useActionState<BilanState, FormData>(saveObjectifs.bind(null, userId, periode, debutKey), {});
  return (
    <form action={action} className="space-y-3">
      <div className="overflow-x-auto rounded-card border border-border bg-surface"><table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] tracking-wide text-text uppercase"><th className="px-3 py-2 font-semibold">Indicateur</th><th className="px-3 py-2 font-semibold">Objectif personnel</th><th className="px-3 py-2 font-semibold">Engagement</th><th className="px-3 py-2 font-semibold">Objectif fixé</th></tr></thead>
        <tbody className="divide-y divide-border">
          {INDICATEURS.map((i) => (
            <tr key={i.key}>
              <td className="px-3 py-2 font-semibold text-title">{i.label}{i.unite ? <span className="ml-1 text-xs font-normal text-text">({i.unite})</span> : null}</td>
              <td className="px-3 py-2">{soi ? <Input name={`${i.key}_personnel`} defaultValue={objectifs[i.key].personnel ?? ""} inputMode="numeric" className="w-28 py-1.5" /> : <span className="tabular-nums">{objectifs[i.key].personnel ?? "—"}</span>}</td>
              <td className="px-3 py-2">{soi ? <Input name={`${i.key}_engagement`} defaultValue={objectifs[i.key].engagement ?? ""} inputMode="numeric" className="w-28 py-1.5" /> : <span className="tabular-nums">{objectifs[i.key].engagement ?? "—"}</span>}</td>
              <td className="px-3 py-2">{direction ? <Input name={`${i.key}_fixe`} defaultValue={objectifs[i.key].fixe ?? ""} inputMode="numeric" className="w-28 py-1.5" /> : <span className="tabular-nums">{objectifs[i.key].fixe ?? "—"}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="text-xs text-muted">Objectif personnel et engagement : fixés par le commercial. Objectif fixé : par son responsable. CA en euros, création + 12 mois.</p>
      <FormError message={state.error} />
      {(soi || direction) && <div className="flex items-center gap-3"><SubmitButton size="sm">Enregistrer les objectifs</SubmitButton>{state.ok && <span className="text-sm text-green">{state.ok}</span>}</div>}
    </form>
  );
}

export function BilanForm({ userId, periode, debutKey, label }: { userId: string; periode: PeriodeBilan; debutKey: string; label: string }) {
  const [state, action] = useActionState<BilanState, FormData>(ajouterBilan.bind(null, userId, periode, debutKey), {});
  return (
    <form action={action} key={state.ok ?? "form"} className="space-y-2">
      <Field label={`Compte rendu · ${label}`}><Textarea name="contenu" rows={5} required placeholder="Ce qui a marché, ce qui a bloqué, les priorités de la période suivante…" /></Field>
      <FormError message={state.error} />
      <div className="flex items-center gap-3"><SubmitButton size="sm">Ajouter le compte rendu</SubmitButton>{state.ok && <span className="text-sm text-green">{state.ok}</span>}</div>
    </form>
  );
}

export function SupprimerBilanButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Supprimer ce compte rendu ?") && start(() => supprimerBilan(id))} aria-label="Supprimer" className="text-text hover:text-pink disabled:opacity-60"><Trash2Icon size={14} /></button>;
}
