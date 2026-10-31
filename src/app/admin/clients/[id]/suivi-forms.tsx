"use client";

import { useActionState, useState } from "react";
import type { EchangeType, Formule } from "@prisma/client";
import { ClipboardPenIcon, PencilIcon } from "lucide-react";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FORMULE } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { logClientEchange, updateClientSuivi, type ActionState } from "../actions";

type Member = { id: string; name: string };
export type SuiviInfo = { id: string; formule: Formule | null; engagementDebut: string; engagementFin: string; gmbUrl: string | null; commercialId: string | null; developpeurId: string | null; reference: boolean };

/** Contrat, suivi et technique : formulaire replié derrière « Modifier ». */
export function SuiviForm({ client, commerciaux, devs, peutAttribuer }: { client: SuiviInfo; commerciaux: Member[]; devs: Member[]; peutAttribuer: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await updateClientSuivi(client.id, prev, fd); if (!r.error) setOpen(false); return r; }, {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-sm text-text hover:text-title"><PencilIcon size={14} /> Modifier</button>;
  return (
    <form action={action} className="col-span-full space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Formule">
          <Select name="formule" defaultValue={client.formule ?? ""}><option value="">—</option>{(Object.keys(FORMULE) as Formule[]).map((f) => <option key={f} value={f}>{FORMULE[f].label}</option>)}</Select>
        </Field>
        <Field label="Fiche Google (GMB)"><Input name="gmbUrl" type="url" defaultValue={client.gmbUrl ?? ""} placeholder="https://g.page/…" /></Field>
        <Field label="Début d’engagement"><Input name="engagementDebut" type="date" defaultValue={client.engagementDebut} /></Field>
        <Field label="Fin d’engagement"><Input name="engagementFin" type="date" defaultValue={client.engagementFin} /></Field>
        <Field label="Suivi par (commercial)">
          <Select name="commercialId" defaultValue={client.commercialId ?? ""} disabled={!peutAttribuer}><option value="">Personne</option>{commerciaux.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        </Field>
        <Field label="Développeur attitré">
          <Select name="developpeurId" defaultValue={client.developpeurId ?? ""}><option value="">Personne</option>{devs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        </Field>
      </div>
      {peutAttribuer && <label className="flex items-center gap-2 text-sm text-text-strong"><input type="checkbox" name="reference" defaultChecked={client.reference} className="size-4 accent-white" /> Client référence (épinglé en tête de liste, appui pour les argumentaires)</label>}
      <FormError message={state.error} />
      <div className="flex gap-2"><SubmitButton size="sm" pendingLabel="Enregistrement…">Enregistrer</SubmitButton><button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-text hover:text-title">Annuler</button></div>
    </form>
  );
}

const TYPES: Array<[EchangeType, string]> = [["APPEL", "Appel"], ["RDV", "Réunion / RDV"], ["MAIL", "Mail"], ["PP", "Visite"], ["NOTE", "Note"]];

/** Compte rendu d'appel ou de réunion saisi à la main. */
export function CompteRenduForm({ clientId, today }: { clientId: string; today: string }) {
  const [type, setType] = useState<EchangeType>("APPEL");
  const [key, setKey] = useState(0);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await logClientEchange(clientId, prev, fd); if (!r.error) setKey((k) => k + 1); return r; }, {});
  return (
    <form key={key} action={action} className="space-y-3 rounded-card border border-border bg-surface p-4">
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map(([t, label]) => <button key={t} type="button" onClick={() => setType(t)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", type === t ? "border-title bg-title text-bg" : "border-border text-text-strong hover:border-text")}>{label}</button>)}
      </div>
      <Textarea name="notes" required placeholder="Compte rendu : ce qui s’est dit, ce qu’il faut retenir, les suites à donner" className="min-h-20" />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Date" hint="par défaut aujourd’hui"><Input name="date" type="date" defaultValue={today} max={today} className="py-2 text-sm" /></Field>
        <SubmitButton size="sm" pendingLabel="Enregistrement…"><ClipboardPenIcon size={14} /> Ajouter le compte rendu</SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
