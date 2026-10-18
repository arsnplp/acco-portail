"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { recommendContact, type RefState } from "./actions";
import { Field, Input, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function RecommendForm() {
  const [state, action] = useActionState<RefState, FormData>(recommendContact, {});
  return (
    <details className="rounded-card border border-border bg-surface" key={state.ok ? "ok" : "form"}>
      <summary className="flex cursor-pointer items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-full border border-border text-title"><UserPlus size={18} /></span>
        <span><span className="block font-semibold text-title">Recommander un contact</span><span className="block text-xs text-text">On l’appelle de votre part, en douceur.</span></span>
      </summary>
      <form action={action} className="space-y-3 border-t border-border p-4">
        <Field label="Son nom ou son commerce"><Input name="contactName" required placeholder="Le fleuriste d’en face" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><Input name="contactPhone" inputMode="tel" /></Field>
          <Field label="Email"><Input name="contactEmail" type="email" /></Field>
        </div>
        <Field label="Un mot pour nous" hint="(facultatif)"><Input name="note" placeholder="Il cherche un site depuis des mois" /></Field>
        <FormError message={state.error} />
        <SubmitButton className="w-full">Envoyer la recommandation</SubmitButton>
      </form>
      {state.ok && <p className="border-t border-border p-4 text-sm text-green">Merci ! On s’en occupe et on vous tient au courant ici.</p>}
    </details>
  );
}
