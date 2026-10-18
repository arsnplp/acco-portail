"use client";

import { useActionState } from "react";
import { askClientDocument, type ActionState } from "./actions";
import { Field, Input, Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function AskClientDocumentForm({ clientId, sites }: { clientId: string; sites: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(askClientDocument.bind(null, clientId), {});
  return (
    <form action={action} className="space-y-3 rounded-card border border-border bg-surface p-4" key={state.ok ? "ok" : "form"}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <Select name="kind" defaultValue="AUTRE"><option value="AUTRE">Autre (Kbis, RIB, logo…)</option><option value="CONTRAT">Contrat signé</option><option value="DEVIS">Devis signé</option><option value="FACTURE">Facture</option></Select>
        </Field>
        <Field label="Site" hint="(facultatif)">
          <Select name="siteId" defaultValue=""><option value="">Aucun</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Quel document ?"><Input name="message" placeholder="Kbis de moins de 3 mois" required maxLength={300} /></Field>
      </div>
      <p className="text-xs text-muted">Le client reçoit une notification et un email, et dépose le fichier en un tap depuis son espace Documents.</p>
      <FormError message={state.error} />
      <div className="flex items-center gap-3"><SubmitButton size="sm">Demander au client</SubmitButton>{state.ok && <span className="text-sm text-green">Demande envoyée</span>}</div>
    </form>
  );
}
