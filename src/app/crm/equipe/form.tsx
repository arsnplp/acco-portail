"use client";

import { useActionState, useTransition } from "react";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { addTeamMember, removeTeamMember, type TeamState } from "./actions";

export function AddMemberForm() {
  const [state, action] = useActionState<TeamState, FormData>(addTeamMember, {});
  return (
    <form action={action} className="space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom"><Input name="firstName" required /></Field>
        <Field label="Nom"><Input name="lastName" /></Field>
      </div>
      <Field label="Email"><Input name="email" type="email" required placeholder="prenom@acco-lab.fr" /></Field>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
      <SubmitButton pendingLabel="Création…">Créer le compte et envoyer l’accès</SubmitButton>
    </form>
  );
}

export function RemoveButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => confirm(`Retirer l’accès de ${name} ? Ses prospects restent, sans commercial.`) && start(() => removeTeamMember(id))} className="text-xs text-text hover:text-pink disabled:opacity-50">
      {pending ? "…" : "Retirer"}
    </button>
  );
}
