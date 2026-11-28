"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/cn";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { demanderRdv, type RdvState } from "../actions";

const FORMATS: [string, string, string][] = [["visio", "Visioconférence", "Un lien Google Meet"], ["tel", "Téléphone", "On vous appelle"], ["presentiel", "En présentiel", "Selon disponibilité"]];

/** Trois champs : date souhaitée, format, motif. La demande part dans Messages, le conseiller confirme le créneau. */
export function RdvForm({ minDate }: { minDate: string }) {
  const [state, action] = useActionState<RdvState, FormData>(demanderRdv, {});
  const [format, setFormat] = useState("visio");
  if (state.ok) return <div className="rounded-card border border-green/40 bg-green/10 p-4 text-sm text-green">{state.ok}</div>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="format" value={format} />
      <Field label="Date souhaitée" hint="Votre conseiller vous propose un horaire précis ce jour-là ou autour."><Input type="date" name="date" min={minDate} required /></Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-title">Format</p>
        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map(([k, l, a]) => <button key={k} type="button" onClick={() => setFormat(k)} aria-pressed={format === k} className={cn("rounded-card border p-3 text-left transition-colors", format === k ? "border-title bg-surface-2" : "border-border hover:border-text")}><span className="block text-sm font-semibold text-title">{l}</span><span className="block text-[11px] leading-snug text-text">{a}</span></button>)}
        </div>
      </div>
      <Field label="De quoi voulez-vous parler ?"><Textarea name="motif" required maxLength={1000} placeholder="Ex. faire le point sur mes résultats, préparer les fêtes, une idée de nouveau service…" className="min-h-24" /></Field>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingLabel="Envoi…">Demander ce rendez-vous</SubmitButton>
    </form>
  );
}
