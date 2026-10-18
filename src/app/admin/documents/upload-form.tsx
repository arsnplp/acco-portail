"use client";

import { useActionState, useState } from "react";
import { uploadDocument, type ActionState } from "./actions";
import { Field, Input, Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

type C = { id: string; name: string; sites: { id: string; name: string }[] };

export function UploadDocumentForm({ clients, defaultClientId, lockClient = false }: { clients: C[]; defaultClientId?: string; lockClient?: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(uploadDocument, {});
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const sites = clients.find((c) => c.id === clientId)?.sites ?? [];
  return (
    <form action={action} className="space-y-3 rounded-card border border-border bg-surface p-4" key={state.ok ? "reset" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client">
          {lockClient ? (
            <><Input value={clients.find((c) => c.id === clientId)?.name ?? ""} readOnly /><input type="hidden" name="clientId" value={clientId} /></>
          ) : (
            <Select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          )}
        </Field>
        <Field label="Site" hint="(facultatif)">
          <Select name="siteId" defaultValue=""><option value="">Aucun</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Type">
          <Select name="kind" defaultValue="FACTURE"><option value="CONTRAT">Contrat</option><option value="FACTURE">Facture</option><option value="DEVIS">Devis</option><option value="AUTRE">Autre</option></Select>
        </Field>
        <Field label="Titre"><Input name="title" placeholder="Facture octobre 2026" required /></Field>
      </div>
      <Field label="Fichier"><Input type="file" name="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" required className="file:mr-3 file:rounded-sm file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:text-title" /></Field>
      <FormError message={state.error} />
      <div className="flex items-center gap-3"><SubmitButton size="sm">Déposer</SubmitButton>{state.ok && <span className="text-sm text-green">Déposé</span>}</div>
    </form>
  );
}
