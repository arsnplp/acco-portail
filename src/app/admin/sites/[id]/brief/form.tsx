"use client";

import { useActionState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { demanderValidationBrief, derogerBrief, deposerPieceBrief, saveBriefSection, supprimerPieceBrief, type BriefState } from "./actions";

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

/** Dépôt de pièces jointes au brief : un ou plusieurs fichiers à la fois (25 Mo max chacun). */
export function PiecesBriefForm({ siteId }: { siteId: string }) {
  const [state, action] = useActionState<BriefState, FormData>(deposerPieceBrief.bind(null, siteId), {});
  return (
    <form action={action} key={state.ok ?? "form"} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Titre" hint="(facultatif, pour un seul fichier)"><Input name="title" placeholder="Logo vectoriel, textes de la page d’accueil, photos de l’atelier…" /></Field>
        <Field label="Fichiers"><Input type="file" name="file" multiple required accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.svg,.ai,.psd" className="file:mr-3 file:rounded-sm file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:text-title" /></Field>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3"><SubmitButton size="sm">Déposer</SubmitButton>{state.ok && <span className="text-sm text-green">{state.ok}</span>}</div>
    </form>
  );
}

export function SupprimerPieceButton({ siteId, docId }: { siteId: string; docId: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => confirm("Supprimer cette pièce du brief ?") && start(() => supprimerPieceBrief(siteId, docId))} aria-label="Supprimer" className="flex size-10 items-center justify-center rounded-full border border-border text-text hover:text-pink disabled:opacity-60"><Trash2Icon size={15} /></button>
  );
}
