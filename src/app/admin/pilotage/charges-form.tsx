"use client";

import { useActionState, useTransition } from "react";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { archiverCharge, saveCharge, type ChargeState } from "./actions";

export type ChargeInit = { id?: string; nom: string; montant: string; categorie: string; type: "MENSUELLE" | "PONCTUELLE"; principale: boolean; debut: string; fin: string; commentaire: string; clientId: string };

export function ChargeForm({ init, categories, clients }: { init: ChargeInit; categories: [string, string][]; clients: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ChargeState, FormData>(saveCharge.bind(null, init.id ?? null), {});
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Nom"><Input name="nom" required defaultValue={init.nom} placeholder="Loyer, Figma, Aircall…" /></Field>
        <Field label="Montant HT (€)"><Input name="montant" inputMode="decimal" required defaultValue={init.montant} /></Field>
        <Field label="Type"><Select name="type" defaultValue={init.type}><option value="MENSUELLE">Mensuelle (récurrente)</option><option value="PONCTUELLE">Ponctuelle</option></Select></Field>
        <Field label="Catégorie"><Select name="categorie" defaultValue={init.categorie}>{categories.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Début / date"><Input name="debut" type="date" required defaultValue={init.debut} /></Field>
        <Field label="Fin (facultatif)"><Input name="fin" type="date" defaultValue={init.fin} /></Field>
        <Field label="Rattachée à un client (coût de projet)"><Select name="clientId" defaultValue={init.clientId}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-text-strong"><input type="checkbox" name="principale" defaultChecked={init.principale} className="size-4" /> Charge fixe principale</label>
      </div>
      <Textarea name="commentaire" defaultValue={init.commentaire} placeholder="Commentaire" className="min-h-12 text-sm" />
      <FormError message={state.error} />
      {state.ok && <p className="text-xs text-green">{state.ok}</p>}
      <SubmitButton size="sm" variant={init.id ? "secondary" : "primary"} pendingLabel="…">{init.id ? "Enregistrer" : "Ajouter la charge"}</SubmitButton>
    </form>
  );
}
export function ArchiverChargeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Archiver cette charge ? Elle reste dans l’historique.") && start(() => archiverCharge(id))} className="text-xs text-text hover:text-pink disabled:opacity-50">Archiver</button>;
}
