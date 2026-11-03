"use client";

import { useActionState, useTransition } from "react";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { annulerCampagne, demanderValidationCampagneAction, lancerCampagneAction, reprendreCampagne, testerCampagne, type CampState } from "../actions";

export function TestForm({ id, defaut }: { id: string; defaut: string }) {
  const [state, action] = useActionState<CampState, FormData>(testerCampagne.bind(null, id), {});
  return <form action={action} className="flex flex-wrap items-end gap-2"><Field label="Envoi test à"><Input name="to" type="email" defaultValue={defaut} /></Field><SubmitButton size="sm" variant="secondary" pendingLabel="…">Envoyer un test</SubmitButton><FormError message={state.error} />{state.ok && <p className="w-full text-xs text-green">{state.ok}</p>}</form>;
}
export function ValiderButton({ id }: { id: string }) {
  const [state, action] = useActionState<CampState, FormData>(async () => demanderValidationCampagneAction(id), {});
  return <form action={action}><SubmitButton size="sm" pendingLabel="…">Demander la validation avant envoi</SubmitButton><FormError message={state.error} />{state.ok && <p className="mt-1 text-xs text-green">{state.ok}</p>}</form>;
}
export function LancerButton({ id, n }: { id: string; n: number }) {
  const [state, action] = useActionState<CampState, FormData>(async () => (confirm(`Lancer l’envoi à ${n} destinataire${n > 1 ? "s" : ""} ? Un email individuel par personne, depuis votre boîte Gmail.`) ? lancerCampagneAction(id) : {}), {});
  return <form action={action}><SubmitButton size="sm" pendingLabel="…">Lancer l’envoi ({n})</SubmitButton><FormError message={state.error} />{state.ok && <p className="mt-1 text-xs text-green">{state.ok}</p>}</form>;
}
export function AnnulerButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Annuler cette campagne ? Les envois restants ne partiront pas.") && start(() => annulerCampagne(id))} className="text-xs text-text hover:text-pink disabled:opacity-50">Annuler la campagne</button>;
}
export function ReprendreButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => reprendreCampagne(id))} className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs text-title hover:border-text disabled:opacity-50">{pending ? "…" : "Reprendre les envois en erreur"}</button>;
}
