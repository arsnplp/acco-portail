"use client";

import { useActionState, useState, useTransition } from "react";
import { FileDownIcon, SendIcon, UploadIcon } from "lucide-react";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cloreContrat, creerAvenantAction, demanderDerogation, deposerScan, envoyerContratAction, genererPdfAction, type ContratState } from "../actions";

export function GenererPdfButton({ contratId }: { contratId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ContratState>({});
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await genererPdfAction(contratId)))} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text disabled:opacity-50"><FileDownIcon size={14} /> {pending ? "Génération…" : "Générer le PDF"}</button>
      {msg.error && <p className="mt-1 text-xs text-pink">{msg.error}</p>}
    </div>
  );
}

/** Envoi ou relance : toujours déclenché par une personne (5.2 F), destinataire modifiable. */
export function EnvoyerForm({ contratId, defaut, relance }: { contratId: string; defaut: { nom: string; email: string } | null; relance: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ContratState, FormData>(async (prev, fd) => { const r = await envoyerContratAction(contratId, prev, fd); if (r.ok) setOpen(false); return r; }, {});
  if (!open) return <div><button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-title px-3 text-xs font-semibold text-bg"><SendIcon size={14} /> {relance ? "Relancer (renvoyer le lien)" : "Envoyer au client"}</button>{state.ok && <p className="mt-1 text-xs text-green">{state.ok}</p>}</div>;
  return (
    <form action={action} className="space-y-2 rounded-card border border-border bg-surface p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Nom du signataire"><Input name="nom" defaultValue={defaut?.nom ?? ""} /></Field>
        <Field label="Email du signataire"><Input name="email" type="email" required defaultValue={defaut?.email ?? ""} /></Field>
      </div>
      <p className="text-xs text-text">Envoi depuis la boîte Gmail du commercial référent (ou de l’agence) avec un lien personnel d’acceptation en ligne.</p>
      <FormError message={state.error} />
      <div className="flex gap-2"><SubmitButton size="sm" pendingLabel="Envoi…">{relance ? "Relancer maintenant" : "Envoyer"}</SubmitButton><button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-text hover:text-title">Annuler</button></div>
    </form>
  );
}

export function ScanForm({ contratId }: { contratId: string }) {
  const [state, action] = useActionState<ContratState, FormData>(deposerScan.bind(null, contratId), {});
  return (
    <details className="rounded-card border border-border bg-surface">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-title"><UploadIcon size={14} /> Déposer un contrat signé à la main (scan)</summary>
      <form action={action} className="space-y-2 border-t border-border p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Fichier (PDF ou image)"><Input name="scan" type="file" accept="application/pdf,image/*" required /></Field>
          <Field label="Nom du signataire"><Input name="nom" required /></Field>
          <Field label="Date de signature"><Input name="date" type="date" /></Field>
        </div>
        <FormError message={state.error} />
        {state.ok && <p className="text-sm text-green">{state.ok}</p>}
        <SubmitButton size="sm" variant="secondary" pendingLabel="Dépôt…">Enregistrer comme signé</SubmitButton>
      </form>
    </details>
  );
}

export function DerogationForm({ contratId }: { contratId: string }) {
  const [state, action] = useActionState<ContratState, FormData>(demanderDerogation.bind(null, contratId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Démarrer sans premier paiement : justification"><Input name="motif" required placeholder="Client de confiance, paiement prévu le…" /></Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">Demander la dérogation</SubmitButton>
      <FormError message={state.error} />
      {state.ok && <p className="w-full text-xs text-green">{state.ok}</p>}
    </form>
  );
}

export function AvenantButton({ contratId }: { contratId: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Créer un avenant ? L’original reste intact ; l’avenant est un nouveau brouillon à envoyer et signer.") && start(() => creerAvenantAction(contratId))} className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text disabled:opacity-50">{pending ? "…" : "Créer un avenant"}</button>;
}

export function CloreButton({ contratId, brouillon }: { contratId: string; brouillon: boolean }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm(brouillon ? "Supprimer ce brouillon ?" : "Terminer ce contrat ? Il reste archivé ; ses abonnements passent résiliés.") && start(() => cloreContrat(contratId))} className="text-xs text-text hover:text-pink disabled:opacity-50">{brouillon ? "Supprimer le brouillon" : "Terminer le contrat"}</button>;
}
