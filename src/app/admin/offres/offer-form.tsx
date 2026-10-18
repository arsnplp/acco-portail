"use client";

import { useActionState } from "react";
import type { Offer } from "@prisma/client";
import { createOffer, updateOffer, type ActionState } from "./actions";
import { Field, Input, Select, Textarea, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function OfferForm({ offer }: { offer?: Offer }) {
  const [state, action] = useActionState<ActionState, FormData>(offer ? updateOffer.bind(null, offer.id) : createOffer, {});
  return (
    <form action={action} className="space-y-3 rounded-card border border-border bg-surface p-4">
      <Field label="Nom"><Input name="name" defaultValue={offer?.name} required placeholder="Plaquette avis Google" /></Field>
      <Field label="Bénéfice en une phrase"><Input name="benefit" defaultValue={offer?.benefit} required placeholder="Recevez plus d’avis Google sans rien faire" /></Field>
      <Field label="Description" hint="(facultatif)"><Textarea name="description" defaultValue={offer?.description ?? ""} /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Prix (€)"><Input name="price" inputMode="decimal" defaultValue={offer ? (offer.priceCents / 100).toString() : ""} required /></Field>
        <Field label="Facturation"><Select name="billing" defaultValue={offer?.billing ?? "MENSUEL"}><option value="MENSUEL">Mensuel</option><option value="PONCTUEL">Ponctuel</option></Select></Field>
        <Field label="Frais fixes (€)" hint="(ex. plaquette)"><Input name="setup" inputMode="decimal" defaultValue={offer?.setupCents != null ? (offer.setupCents / 100).toString() : ""} /></Field>
        <Field label="Module débloqué"><Select name="module" defaultValue={offer?.module ?? "NONE"}><option value="NONE">Aucun</option><option value="AVIS">Avis Google</option></Select></Field>
      </div>
      <Field label="Ordre d’affichage"><Input name="order" inputMode="numeric" defaultValue={offer?.order ?? 0} className="w-24" /></Field>
      <FormError message={state.error} />
      <div className="flex items-center gap-3"><SubmitButton size="sm">{offer ? "Enregistrer" : "Créer l’offre"}</SubmitButton>{state.ok && <span className="text-sm text-green">Enregistré</span>}</div>
    </form>
  );
}
