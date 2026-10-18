"use client";

import { useActionState } from "react";
import { createClient, type ActionState } from "../actions";
import { Field, Input, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function NewClientForm() {
  const [state, action] = useActionState<ActionState, FormData>(createClient, {});
  return (
    <form action={action} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-base">Entreprise</h2>
        <Field label="Nom de l’entreprise"><Input name="name" required placeholder="Boulangerie Dupont" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone"><Input name="phone" inputMode="tel" /></Field>
          <Field label="Email de l’entreprise"><Input name="email" type="email" /></Field>
        </div>
        <Field label="Adresse"><Input name="address" /></Field>
        <Field label="SIREN" hint="(facultatif)"><Input name="siren" /></Field>
      </section>
      <section className="space-y-4">
        <h2 className="text-base">Gérant (compte principal)</h2>
        <p className="text-sm text-text">Le compte est créé tout de suite. Aucun email n’est envoyé pour l’instant : l’invitation arrive à l’étape 3.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom"><Input name="ownerFirstName" required /></Field>
          <Field label="Nom"><Input name="ownerLastName" /></Field>
        </div>
        <Field label="Email du gérant"><Input name="ownerEmail" type="email" required /></Field>
      </section>
      <FormError message={state.error} />
      <SubmitButton size="lg">Créer le client</SubmitButton>
    </form>
  );
}
