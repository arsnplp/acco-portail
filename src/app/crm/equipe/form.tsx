"use client";

import { useActionState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { EQUIPE, ROLE_LABEL } from "@/lib/roles";
import { addTeamMember, removeTeamMember, setTeamRole, type TeamState } from "./actions";

const AIDE: Record<string, string> = {
  ADMIN: "Accès total : Pilotage, Prospection, Suivi.",
  COMMERCIAL: "Prospection (CRM) et Suivi des clients.",
  DEV: "Suivi seulement : clients, sites, production.",
  EXPERT: "Prestataire externe : Suivi seulement.",
  SPECIALISTE: "Profil interne (SEO, Ads…) : Suivi seulement.",
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

export function RemoveButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => confirm(`Retirer l’accès de ${name} ? Ses prospects et clients restent, sans responsable.`) && start(() => removeTeamMember(id))} className="text-xs text-text hover:text-pink disabled:opacity-50">
      {pending ? "…" : "Retirer"}
    </button>
  );
}
