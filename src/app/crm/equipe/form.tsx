"use client";

import { useActionState, useState, useTransition } from "react";
import type { Mode, Role } from "@prisma/client";
import { ChevronDownIcon } from "lucide-react";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { EQUIPE, MODE_LABEL, ROLE_LABEL } from "@/lib/roles";
import { DROITS, PRESETS, type Droit, type Preset } from "@/lib/permissions";
import { addTeamMember, appliquerPreset, creerDelegation, removeTeamMember, setTeamDroits, setTeamMode, setTeamRole, terminerDelegation, type TeamState } from "./actions";

const AIDE: Record<string, string> = {
  ADMIN: "Accès total : Pilotage, Prospection, Suivi, Administration.",
  COMMERCIAL: "Prospection (CRM) et Suivi des clients.",
  DEV: "Suivi seulement : clients, sites, production.",
  EXPERT: "Prestataire externe : uniquement les projets attribués.",
  SPECIALISTE: "Spécialiste (SEO, Ads…) : uniquement les projets attribués.",
};

export function AddMemberForm() {
  const [state, action] = useActionState<TeamState, FormData>(addTeamMember, {});
  return (
    <form action={action} className="space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom"><Input name="firstName" required /></Field>
        <Field label="Nom"><Input name="lastName" /></Field>
      </div>
      <Field label="Email"><Input name="email" type="email" required placeholder="prenom@acco-lab.fr" /></Field>
      <Field label="Rôle">
        <Select name="role" defaultValue="COMMERCIAL">{EQUIPE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]} — {AIDE[r]}</option>)}</Select>
      </Field>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
      <SubmitButton pendingLabel="Création…">Créer le compte et envoyer l’accès</SubmitButton>
    </form>
  );
}

export function RoleSelect({ id, role, self }: { id: string; role: Role; self: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select value={role} disabled={pending || self} title={self ? "Vous ne pouvez pas changer votre propre rôle" : undefined} onChange={(e) => start(() => setTeamRole(id, e.target.value as Role))} aria-label="Rôle" className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-strong disabled:opacity-60">
      {EQUIPE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  );
}

export function ModeSelect({ id, role, mode }: { id: string; role: Role; mode: Mode | null }) {
  const [pending, start] = useTransition();
  const modes = (Object.keys(MODE_LABEL) as Mode[]).filter((m) => m !== "ADMIN" || role === "ADMIN");
  return (
    <select value={mode ?? ""} disabled={pending} onChange={(e) => start(() => setTeamMode(id, e.target.value as Mode | ""))} aria-label="Mode de démarrage" className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-strong disabled:opacity-60">
      <option value="">Démarrage selon le rôle</option>
      {modes.map((m) => <option key={m} value={m}>Démarre en {MODE_LABEL[m]}</option>)}
    </select>
  );
}

/** Droits unitaires du membre : ceux hérités du rôle sont cochés et verrouillés, les autres se cochent un à un. */
export function DroitsEditor({ id, droits, implicites, self }: { id: string; droits: string[]; implicites: string[]; self: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [choisis, setChoisis] = useState<string[]>(droits);
  const toggle = (d: Droit) => {
    const next = choisis.includes(d) ? choisis.filter((x) => x !== d) : [...choisis, d];
    setChoisis(next);
    start(() => setTeamDroits(id, next));
  };
  const total = new Set([...implicites, ...choisis]).size;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs text-text hover:text-title">
        <ChevronDownIcon size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden /> Droits ({total}/{Object.keys(DROITS).length})
      </button>
      {open && (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {(Object.keys(DROITS) as Droit[]).map((d) => {
            const herite = implicites.includes(d);
            return (
              <li key={d}>
                <label className={`flex items-start gap-2 text-xs ${herite ? "text-text" : "text-text-strong"}`}>
                  <input type="checkbox" checked={herite || choisis.includes(d)} disabled={herite || pending || self} onChange={() => toggle(d)} className="mt-0.5 accent-[var(--color-green)]" />
                  <span>{DROITS[d]}{herite && <span className="ml-1 text-muted">(par le rôle)</span>}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PresetMenu({ id, self }: { id: string; self: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select value="" disabled={pending || self} onChange={(e) => { const p = e.target.value as Preset; if (p && confirm(`Appliquer : ${PRESETS[p].label} ?`)) start(() => appliquerPreset(id, p)); }} aria-label="Réglages par défaut" className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-strong disabled:opacity-60">
      <option value="">Réglages par défaut…</option>
      {(Object.keys(PRESETS) as Preset[]).map((p) => <option key={p} value={p}>{PRESETS[p].label.split(" : ")[0]}</option>)}
    </select>
  );
}

export function RemoveButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => confirm(`Retirer l’accès de ${name} ? Ses prospects et clients restent, sans responsable.`) && start(() => removeTeamMember(id))} className="text-xs text-text hover:text-pink disabled:opacity-50">
      {pending ? "…" : "Retirer"}
    </button>
  );
}

type Membre = { id: string; nom: string };
export function DelegationForm({ membres, clients }: { membres: Membre[]; clients: Membre[] }) {
  const [state, action] = useActionState<TeamState, FormData>(creerDelegation, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Référent remplacé"><Select name="deId" required defaultValue="">{[<option key="" value="" disabled>Choisir…</option>, ...membres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)]}</Select></Field>
        <Field label="Délégataire"><Select name="versId" required defaultValue="">{[<option key="" value="" disabled>Choisir…</option>, ...membres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)]}</Select></Field>
        <Field label="Du"><Input name="debut" type="date" required defaultValue={today} /></Field>
        <Field label="Au (inclus)"><Input name="fin" type="date" required /></Field>
      </div>
      <Field label="Périmètre" hint="Tout le portefeuille, ou un seul client">
        <Select name="clientId" defaultValue=""><option value="">Tout le portefeuille du référent</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select>
      </Field>
      <Field label="Motif"><Textarea name="motif" rows={2} placeholder="Congés, absence, renfort…" /></Field>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
      <SubmitButton size="sm" pendingLabel="Enregistrement…">Enregistrer la délégation</SubmitButton>
    </form>
  );
}

export function TerminerDelegationButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Mettre fin à cette délégation maintenant ?") && start(() => terminerDelegation(id))} className="text-xs text-text hover:text-pink disabled:opacity-50">{pending ? "…" : "Terminer"}</button>;
}
