"use client";

import { useActionState } from "react";
import type { DocumentKind } from "@prisma/client";
import { uploadDocument, type ActionState } from "./actions";
import { Field, Input, Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  clientId: string;
  sites: { id: string; name: string }[];
  defaults?: { kind?: DocumentKind; siteId?: string | null; title?: string; requestId?: string };
  compact?: boolean;
  submitLabel?: string;
};

export function UploadDocumentForm({ clientId, sites, defaults, compact, submitLabel = "Déposer" }: Props) {
  const [state, action] = useActionState<ActionState, FormData>(uploadDocument, {});
  return (
    <form action={action} className={`space-y-3 ${compact ? "" : "rounded-card border border-border bg-surface p-4"}`} key={state.ok ? "reset" : "form"}>
      <input type="hidden" name="clientId" value={clientId} />
      {defaults?.requestId && <input type="hidden" name="requestId" value={defaults.requestId} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <Select name="kind" defaultValue={defaults?.kind ?? "FACTURE"}><option value="CONTRAT">Contrat</option><option value="FACTURE">Facture</option><option value="DEVIS">Devis</option><option value="AUTRE">Autre</option></Select>
        </Field>
        <Field label="Site" hint="(facultatif)">
          <Select name="siteId" defaultValue={defaults?.siteId ?? ""}><option value="">Aucun</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Titre"><Input name="title" defaultValue={defaults?.title ?? ""} placeholder="Facture octobre 2026" required /></Field>
      </div>
      <Field label="Fichier"><Input type="file" name="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" required className="file:mr-3 file:rounded-sm file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:text-title" /></Field>
      <FormError message={state.error} />
      <div className="flex items-center gap-3"><SubmitButton size="sm">{submitLabel}</SubmitButton>{state.ok && <span className="text-sm text-green">Envoyé au client</span>}</div>
    </form>
  );
}
