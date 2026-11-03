"use client";

import { useActionState, useTransition, useState } from "react";
import { SendIcon } from "lucide-react";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ajouterRetour, cocherRetour, demanderGoLiveAction, demanderValidationMaquetteAction, deposerReceptionAction, envoyerMaquetteAction, retoursTerminesAction, supprimerRetour, verifierSiteAction, type ActionState } from "../actions";
import { Trash2Icon, PlayIcon, CheckCircle2Icon, XCircleIcon, MinusCircleIcon } from "lucide-react";

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

type V = { key: string; label: string; ok: boolean | null; detail: string };
/** Checklist de mise en ligne : la machine vérifie, Arsène ne coche que le reste. */
export function GoLiveForm({ siteId, checklist, rapport }: { siteId: string; checklist: string[]; rapport: { at: string; base: string; pages: number; verifs: V[]; ok: boolean } | null }) {
  const [state, action] = useActionState<ActionState, FormData>(demanderGoLiveAction.bind(null, siteId), {});
  if (state.ok) return <p className="text-sm text-green">Autorisation de mise en ligne demandée à Arsène.</p>;
  return (
    <form action={action} className="space-y-3">
      <VerifierButton siteId={siteId} rapport={rapport} />
      <ul className="grid gap-1 sm:grid-cols-2">{checklist.map((c) => <li key={c}><label className="flex items-start gap-2 text-sm text-text-strong"><input type="checkbox" name="check" value={c} className="mt-1 size-4" /> {c}</label></li>)}</ul>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="…" disabled={!rapport || !rapport.ok}>Demander l’autorisation de mise en ligne</SubmitButton>
    </form>
  );
}
export function VerifierButton({ siteId, rapport }: { siteId: string; rapport: { at: string; base: string; pages: number; verifs: V[]; ok: boolean } | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>({});
  return (
    <div className="rounded-card border border-border bg-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await verifierSiteAction(siteId)))} className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text disabled:opacity-50"><PlayIcon size={13} /> {pending ? "Vérification en cours…" : rapport ? "Relancer la vérification automatique" : "Lancer la vérification automatique"}</button>
        {rapport && <span className="text-xs text-text">{new Date(rapport.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })} · {rapport.base} · {rapport.pages} page{rapport.pages > 1 ? "s" : ""} · {rapport.ok ? <span className="text-green">tout est bon</span> : <span className="text-pink">{rapport.verifs.filter((v) => v.ok === false).length} point(s) à corriger</span>}</span>}
        {msg.error && <span className="text-xs text-pink">{msg.error}</span>}
      </div>
      {rapport && (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {rapport.verifs.map((v) => <li key={v.key} className="flex items-start gap-2 text-xs"><span className="mt-0.5 shrink-0">{v.ok === true ? <CheckCircle2Icon size={14} className="text-green" /> : v.ok === false ? <XCircleIcon size={14} className="text-pink" /> : <MinusCircleIcon size={14} className="text-muted" />}</span><span className={v.ok === false ? "text-text-strong" : "text-text"}>{v.label}<span className="block text-[11px] text-muted">{v.detail}</span></span></li>)}
        </ul>
      )}
      {!rapport && <p className="mt-1 text-xs text-text">Liens, mobile, titres et meta, H1, alt des images, langue, mentions légales, confidentialité, mention « Réalisé par Acco », formulaire relié, téléphone et adresse, HTTPS, performance.</p>}
    </div>
  );
}

type Retour = { id: string; texte: string; page: string | null; fait: boolean; version: number };
/** Retours de création : notés pendant les réunions avec le client, cochés par le développeur. */
export function RetoursCreation({ siteId, retours, version, etapeModifier, externe }: { siteId: string; retours: Retour[]; version: number; etapeModifier: boolean; externe: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(ajouterRetour.bind(null, siteId), {});
  const [pending, start] = useTransition();
  const [fin, setFin] = useState<ActionState>({});
  const ouverts = retours.filter((r) => !r.fait);
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {retours.length === 0 && <li className="px-4 py-3 text-sm text-text">Aucun retour noté. Pendant la réunion avec le client, notez ici chaque modification demandée.</li>}
        {retours.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            <input type="checkbox" checked={r.fait} disabled={pending} onChange={(e) => start(() => cocherRetour(siteId, r.id, e.target.checked))} className="size-4" aria-label="Fait" />
            <span className={`min-w-0 flex-1 ${r.fait ? "text-text line-through" : "text-title"}`}>{r.texte}{r.page ? <span className="text-xs text-text"> · {r.page}</span> : null}<span className="text-xs text-muted"> · V{r.version}</span></span>
            {!externe && <button type="button" disabled={pending} onClick={() => start(() => supprimerRetour(siteId, r.id))} aria-label="Supprimer" className="text-muted hover:text-pink"><Trash2Icon size={13} /></button>}
          </li>
        ))}
      </ul>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <Input name="texte" required placeholder={`Retour du client sur la V${version} (ex. changer la couleur du bouton)`} className="min-w-64 flex-1 py-1.5 text-sm" />
        <Input name="page" placeholder="Page (facultatif)" className="w-36 py-1.5 text-sm" />
        <SubmitButton size="sm" variant="secondary" pendingLabel="…">Ajouter</SubmitButton>
        <FormError message={state.error} />
      </form>
      {etapeModifier && retours.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || ouverts.length > 0} onClick={() => confirm(`Tout est fait : passer en « Valider modification » (V${version + 1} à présenter au client) ?`) && start(async () => setFin(await retoursTerminesAction(siteId)))} className="inline-flex h-8 items-center rounded-full bg-title px-3 text-xs font-semibold text-bg disabled:opacity-50">Tout est fait → nouvelle version à présenter</button>
          {ouverts.length > 0 && <span className="text-xs text-text">{ouverts.length} retour{ouverts.length > 1 ? "s" : ""} encore à faire</span>}
          {fin.error && <span className="text-xs text-pink">{fin.error}</span>}
        </div>
      )}
    </div>
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
