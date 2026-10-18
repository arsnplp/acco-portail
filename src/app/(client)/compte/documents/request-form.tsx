"use client";

import { useActionState } from "react";
import { FilePlus2 } from "lucide-react";
import { requestDocument, type ActionState } from "./actions";
import { Field, Input, Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function RequestDocumentForm({ sites }: { sites: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(requestDocument, {});
  return (
    <details className="rounded-card border border-border bg-surface" key={state.ok ? "ok" : "form"}>
      <summary className="flex cursor-pointer items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-title text-bg"><FilePlus2 size={18} /></span>
        <span><span className="block font-semibold text-title">Demander un document</span><span className="block text-xs text-text">Une facture, un contrat, un devis… on vous l’envoie ici.</span></span>
      </summary>
      <form action={action} className="space-y-3 border-t border-border p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quel document ?">
            <Select name="kind" defaultValue="FACTURE"><option value="FACTURE">Facture</option><option value="CONTRAT">Contrat</option><option value="DEVIS">Devis</option><option value="AUTRE">Autre</option></Select>
          </Field>
          {sites.length > 1 ? (
            <Field label="Pour quel site ?"><Select name="siteId" defaultValue=""><option value="">Peu importe</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          ) : sites[0] ? <input type="hidden" name="siteId" value={sites[0].id} /> : null}
        </div>
        <Field label="Précision" hint="(ex. « facture de septembre »)"><Input name="message" maxLength={500} placeholder="Facultatif sauf pour « Autre »" /></Field>
        <FormError message={state.error} />
        <SubmitButton size="md" className="w-full">Envoyer la demande</SubmitButton>
      </form>
      {state.ok && <p className="border-t border-border p-4 text-sm text-green">Demande envoyée, l’équipe s’en occupe.</p>}
    </details>
  );
}
