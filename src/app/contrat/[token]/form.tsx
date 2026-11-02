"use client";

import { useActionState, useState } from "react";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { accepter, demanderCode, refuser, type AccepterState } from "./actions";

/** Acceptation en ligne maison (00.5) : email → code → nom + case + code. */
export function AcceptationForm({ token, emailDefaut }: { token: string; emailDefaut: string | null }) {
  const [email, setEmail] = useState(emailDefaut ?? "");
  const [s1, a1] = useActionState<AccepterState, FormData>(demanderCode.bind(null, token), {});
  const [s2, a2] = useActionState<AccepterState, FormData>(accepter.bind(null, token), {});
  const [s3, a3] = useActionState<AccepterState, FormData>(refuser.bind(null, token), {});
  const [refus, setRefus] = useState(false);
  if (s2.signe) return <div className="rounded-card border border-green/40 bg-green/10 p-4 text-sm text-green"><p className="font-semibold">Contrat accepté. Merci !</p><p className="mt-1">Un certificat de preuve a été archivé avec le document. Votre interlocuteur ACCO LAB revient vers vous pour la suite (accès au portail, brief).</p></div>;
  if (s3.refuse) return <p className="rounded-card border border-border bg-surface p-4 text-sm text-text">Refus enregistré. Votre interlocuteur en est informé.</p>;
  const codeEnvoye = s1.codeEnvoye || s2.codeEnvoye;
  return (
    <div className="space-y-4">
      {!codeEnvoye ? (
        <form action={a1} className="space-y-3 rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-text-strong">1. Recevez un code de confirmation par email.</p>
          <Field label="Votre adresse email"><Input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <FormError message={s1.error} />
          <SubmitButton pendingLabel="Envoi…">Recevoir le code</SubmitButton>
        </form>
      ) : (
        <form action={a2} className="space-y-3 rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-text-strong">2. Confirmez votre acceptation.</p>
          <input type="hidden" name="email" value={email} />
          <p className="text-xs text-text">Code envoyé à {email} (valable 15 minutes).</p>
          <Field label="Votre nom et prénom"><Input name="nom" required /></Field>
          <Field label="Code reçu par email"><Input name="code" inputMode="numeric" required maxLength={6} className="tracking-[0.3em]" /></Field>
          <label className="flex items-start gap-2 text-sm text-text-strong"><input type="checkbox" name="accepte" required className="mt-1 size-4" /> J’ai lu le contrat ci-dessus et je l’accepte. Cette acceptation vaut signature.</label>
          <FormError message={s2.error} />
          <SubmitButton pendingLabel="Vérification…">Accepter le contrat</SubmitButton>
        </form>
      )}
      {!refus ? <button type="button" onClick={() => setRefus(true)} className="text-xs text-text hover:text-title">Je ne souhaite pas accepter ce contrat</button> : (
        <form action={a3} className="space-y-2 rounded-card border border-border p-4">
          <Field label="Motif (facultatif)"><Input name="motif" /></Field>
          <FormError message={s3.error} />
          <SubmitButton size="sm" variant="secondary" pendingLabel="…">Refuser le contrat</SubmitButton>
        </form>
      )}
    </div>
  );
}
