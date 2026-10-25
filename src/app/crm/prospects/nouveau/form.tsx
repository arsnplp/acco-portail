"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ProspectSource } from "@prisma/client";
import { SOURCE } from "@/lib/crm";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createProspect, type CrmState } from "../../actions";

export function NewProspectForm({ meId, team, cibles, today }: { meId: string; team: { id: string; name: string }[]; cibles: string[]; today: string }) {
  const [state, action] = useActionState<CrmState, FormData>(createProspect, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        <Field label="Société"><Input name="societe" required autoFocus placeholder="Institut Belle Peau" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom du contact"><Input name="prenom" /></Field>
          <Field label="Nom"><Input name="nom" /></Field>
          <Field label="Téléphone"><Input name="telephone" inputMode="tel" /></Field>
          <Field label="Email"><Input name="email" type="email" /></Field>
        </div>
        <Field label="Fonction" hint="optionnel"><Input name="fonction" placeholder="Gérante" /></Field>
      </div>
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cible">
            <Input name="cible" list="cibles-new" placeholder="Esthéticienne…" />
            <datalist id="cibles-new">{cibles.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Source">
            <Select name="source" defaultValue="COLD_CALL">{(Object.keys(SOURCE) as ProspectSource[]).map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}</Select>
          </Field>
          <Field label="Commercial">
            <Select name="commercialId" defaultValue={meId}>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}<option value="">Personne</option></Select>
          </Field>
          <Field label="Première relance"><Input type="date" name="relance" defaultValue={today} /></Field>
        </div>
        <Field label="Site web" hint="optionnel"><Input name="siteWeb" placeholder="exemple.fr" /></Field>
        <Field label="Adresse" hint="optionnel"><Input name="adresse" /></Field>
        <Field label="SIREN" hint="optionnel"><Input name="siren" inputMode="numeric" /></Field>
      </div>
      {state.doublon && (
        <div className="space-y-2 rounded-card border border-yellow/40 bg-yellow/10 p-4 text-sm text-yellow">
          <p>{state.error}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={state.doublon.client ? `/admin/clients/${state.doublon.id}` : `/crm/prospects/${state.doublon.id}`} className="font-semibold underline">Ouvrir la fiche existante</Link>
            <button type="submit" name="force" value="1" className="text-text hover:text-title">Créer quand même</button>
          </div>
        </div>
      )}
      {!state.doublon && <FormError message={state.error} />}
      <SubmitButton className="w-full" pendingLabel="Création…">Créer le prospect</SubmitButton>
    </form>
  );
}
