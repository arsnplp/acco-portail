"use client";

import { useActionState, useTransition, useState } from "react";
import { SendIcon } from "lucide-react";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { demanderGoLiveAction, demanderValidationMaquetteAction, deposerReceptionAction, envoyerMaquetteAction, type ActionState } from "../actions";

export function DemanderValidationMaquetteButton({ siteId }: { siteId: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => demanderValidationMaquetteAction(siteId))} className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text disabled:opacity-50">{pending ? "…" : "Demander la validation interne (Bilel et Arsène)"}</button>;
}

/** « Envoyer maquette » : clic explicite, après le rendez-vous (10.4). */
export function EnvoyerMaquetteButton({ siteId, version }: { siteId: string; version: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => confirm(`Envoyer la maquette V${version} au client ? Le lien devient visible dans son portail et il est prévenu.`) && start(async () => { const r = await envoyerMaquetteAction(siteId); setErr(r.error ?? null); })} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-title px-3 text-xs font-semibold text-bg disabled:opacity-50"><SendIcon size={14} /> {pending ? "Envoi…" : "Envoyer maquette"}</button>
      {err && <p className="mt-1 text-xs text-pink">{err}</p>}
    </div>
  );
}

export function GoLiveForm({ siteId, checklist }: { siteId: string; checklist: string[] }) {
  const [state, action] = useActionState<ActionState, FormData>(demanderGoLiveAction.bind(null, siteId), {});
  if (state.ok) return <p className="text-sm text-green">Autorisation de mise en ligne demandée à Arsène.</p>;
  return (
    <form action={action} className="space-y-2">
      <ul className="grid gap-1 sm:grid-cols-2">{checklist.map((c) => <li key={c}><label className="flex items-start gap-2 text-sm text-text-strong"><input type="checkbox" name="check" value={c} className="mt-1 size-4" /> {c}</label></li>)}</ul>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="…">Demander l’autorisation de mise en ligne</SubmitButton>
    </form>
  );
}

export function ReceptionForm({ siteId }: { siteId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deposerReceptionAction.bind(null, siteId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Document de réception signé"><Input name="reception" type="file" accept="application/pdf,image/*" required /></Field>
      <Field label="Date"><Input name="date" type="date" /></Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">Archiver la réception</SubmitButton>
      <FormError message={state.error} />
      {state.ok && <p className="w-full text-xs text-green">Réception archivée.</p>}
    </form>
  );
}
