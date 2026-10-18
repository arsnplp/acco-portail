"use client";

import { useActionState } from "react";
import { createPromotion, type ActionState } from "../actions";
import { Field, Input, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function PromoForm({ offerId }: { offerId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createPromotion.bind(null, offerId), {});
  return (
    <form action={action} className="space-y-3 rounded-card border border-dashed border-border p-4" key={state.ok ? "ok" : "form"}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Libellé"><Input name="label" placeholder="Offre de rentrée" required /></Field>
        <Field label="Prix promo (€)"><Input name="promoPrice" inputMode="decimal" /></Field>
        <Field label="ou remise (%)"><Input name="percentOff" inputMode="numeric" /></Field>
        <Field label="Fin"><Input name="endsAt" type="date" required /></Field>
      </div>
      <FormError message={state.error} />
      <SubmitButton size="sm" variant="secondary">Ajouter la promo</SubmitButton>
    </form>
  );
}
