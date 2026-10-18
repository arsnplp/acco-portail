"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitLead, type LeadState } from "./actions";
import { Field, Input, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function LeadForm({ code }: { code: string }) {
  const [state, action] = useActionState<LeadState, FormData>(submitLead.bind(null, code), {});
  if (state.ok) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 text-center">
        <CheckCircle2 className="mx-auto text-green" size={28} />
        <p className="mt-3 font-semibold text-title">Merci ! On vous rappelle très vite.</p>
        <p className="mt-1 text-sm text-text">En général sous 24 h ouvrées.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="Votre prénom et nom"><Input name="name" required autoComplete="name" /></Field>
      <Field label="Votre commerce ou activité"><Input name="business" required placeholder="Fleuriste, plombier, restaurant…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Téléphone"><Input name="phone" inputMode="tel" autoComplete="tel" /></Field>
        <Field label="Email"><Input name="email" type="email" autoComplete="email" /></Field>
      </div>
      <Field label="Votre projet en une phrase" hint="(facultatif)"><Input name="note" placeholder="J’ai besoin d’un site pour être trouvé sur Google" /></Field>
      <div className="absolute -left-[9999px]" aria-hidden><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <FormError message={state.error} />
      <SubmitButton size="lg" className="w-full">Être rappelé gratuitement</SubmitButton>
      <p className="text-center text-xs text-muted">Sans engagement. Vos coordonnées servent uniquement à vous rappeler.</p>
    </form>
  );
}
