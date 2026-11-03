"use client";

import { useActionState } from "react";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { demanderValidationBrief, derogerBrief, saveBriefSection, type BriefState } from "./actions";

const ETATS: Array<[string, string]> = [["ATTENDU", "Attendu"], ["RECU", "Reçu"], ["INCOMPLET", "Incomplet"], ["VALIDE", "Validé"]];

export function SectionForm({ siteId, sectionKey, texte, etat, aide }: { siteId: string; sectionKey: string; texte: string; etat: string; aide: string }) {
  const [state, action] = useActionState<BriefState, FormData>(saveBriefSection.bind(null, siteId, sectionKey), {});
  return (
    <form action={action} className="space-y-2">
      <Textarea name="texte" defaultValue={texte} placeholder={aide} className="min-h-24 text-sm" />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="État"><Select name="etat" defaultValue={etat} className="py-1.5 text-sm">{ETATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <SubmitButton size="sm" variant="secondary" pendingLabel="…">Enregistrer</SubmitButton>
        {state.ok && <span className="text-xs text-green">{state.ok}</span>}
      </div>
      <FormError message={state.error} />
    </form>
  );
}

export function DemanderValidationButton({ siteId }: { siteId: string }) {
  const [state, action] = useActionState<BriefState, FormData>(async () => demanderValidationBrief(siteId), {});
  return (
    <form action={action} className="space-y-1">
      <SubmitButton size="sm" pendingLabel="…">Demander la double validation (commercial, puis Arsène)</SubmitButton>
      <FormError message={state.error} />
      {state.ok && <p className="text-xs text-green">{state.ok}</p>}
    </form>
  );
}

export function DerogationForm({ siteId }: { siteId: string }) {
  const [state, action] = useActionState<BriefState, FormData>(derogerBrief.bind(null, siteId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Dérogation d’Arsène sur les points non essentiels : justification"><Input name="note" required placeholder="Carte blanche du client sur le style…" /></Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">Enregistrer la dérogation</SubmitButton>
      <FormError message={state.error} />
      {state.ok && <p className="w-full text-xs text-green">{state.ok}</p>}
    </form>
  );
}
