"use client";

import { useActionState, useTransition } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { changerEcheanceTache, changerStatutTache, creerTacheDepuisGestionnaire, reattribuerTache, type TacheState } from "./actions";

type Membre = { id: string; name: string };
export function TacheRowActions({ id, responsableId, membres, echeance }: { id: string; responsableId: string | null; membres: Membre[]; echeance: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select value={responsableId ?? ""} disabled={pending} onChange={(e) => start(() => reattribuerTache(id, e.target.value || null))} aria-label="Responsable" className="h-8 rounded-full border border-border bg-surface px-2 text-xs text-text-strong"><option value="">Personne</option>{membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <input type="date" defaultValue={echeance} disabled={pending} onChange={(e) => { const motif = window.prompt("Motif du changement d’échéance (facultatif) :") ?? ""; start(() => changerEcheanceTache(id, e.target.value, motif)); }} aria-label="Échéance" className="h-8 rounded-full border border-border bg-surface px-2 text-xs text-text-strong" />
      <button type="button" disabled={pending} onClick={() => start(() => changerStatutTache(id, "FAIT"))} aria-label="Fait" className="flex size-8 items-center justify-center rounded-full bg-green text-bg disabled:opacity-50"><CheckIcon size={14} /></button>
      <button type="button" disabled={pending} onClick={() => confirm("Annuler cette tâche ?") && start(() => changerStatutTache(id, "ANNULEE"))} aria-label="Annuler" className="flex size-8 items-center justify-center rounded-full border border-border text-text hover:text-pink disabled:opacity-50"><XIcon size={14} /></button>
    </div>
  );
}
export function NouvelleTacheForm({ membres, clients, meId }: { membres: Membre[]; clients: Membre[]; meId: string }) {
  const [state, action] = useActionState<TacheState, FormData>(creerTacheDepuisGestionnaire, {});
  return (
    <form action={action} className="grid gap-2 rounded-card border border-border bg-surface p-4 sm:grid-cols-5">
      <Field label="Client"><Select name="clientId" required defaultValue=""><option value="" disabled>Choisir…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Tâche"><Input name="titre" required /></Field>
      <Field label="Type"><Select name="type" defaultValue="AUTRE"><option value="RELANCE">Relance</option><option value="RDV_A_PLANIFIER">RDV à planifier</option><option value="APPEL">Appel</option><option value="EMAIL">Email</option><option value="DOCUMENT">Document</option><option value="MAINTENANCE">Maintenance</option><option value="AUTRE">Autre</option></Select></Field>
      <Field label="Échéance"><Input name="echeance" type="date" /></Field>
      <Field label="Responsable"><Select name="responsableId" defaultValue={meId}>{membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
      <div className="sm:col-span-5 flex items-center gap-3"><SubmitButton size="sm" pendingLabel="…">Ajouter</SubmitButton><FormError message={state.error} /></div>
    </form>
  );
}
