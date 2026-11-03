"use client";

import { useActionState } from "react";
import type { NotificationPreference } from "@prisma/client";
import { setOptOutCommercial, updateCompany, updateProfile, updateNotificationPrefs, uploadLogoClient, type ActionState } from "./actions";
import { Field, Input, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";

export function CompanyForm({ client, editable }: { client: { name: string; address: string | null; phone: string | null; email: string | null }; editable: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(updateCompany, {});
  if (!editable) {
    return <Card><p className="font-semibold text-title">{client.name}</p><p className="mt-1 text-sm text-text">{client.address ?? "Adresse non renseignée"}</p><p className="text-sm text-text">{client.phone ?? ""}</p></Card>;
  }
  return (
    <details className="rounded-card border border-border bg-surface">
      <summary className="cursor-pointer p-4"><span className="font-semibold text-title">{client.name}</span><span className="block text-sm text-text">{client.address ?? "Adresse non renseignée"} · {client.phone ?? "téléphone non renseigné"}</span><span className="mt-1 block text-xs text-muted">Toucher pour modifier</span></summary>
      <form action={action} className="space-y-3 border-t border-border p-4">
        <Field label="Nom de l’entreprise"><Input name="name" defaultValue={client.name} required /></Field>
        <Field label="Adresse"><Input name="address" defaultValue={client.address ?? ""} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><Input name="phone" inputMode="tel" defaultValue={client.phone ?? ""} /></Field>
          <Field label="Email"><Input name="email" type="email" defaultValue={client.email ?? ""} /></Field>
        </div>
        <FormError message={state.error} />
        <div className="flex items-center gap-3"><SubmitButton size="sm">Enregistrer</SubmitButton>{state.ok && <span className="text-sm text-green">Enregistré</span>}</div>
      </form>
    </details>
  );
}

export function ProfileForm({ user }: { user: { firstName: string | null; lastName: string | null; email: string } }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom"><Input name="firstName" defaultValue={user.firstName ?? ""} required /></Field>
        <Field label="Nom"><Input name="lastName" defaultValue={user.lastName ?? ""} /></Field>
      </div>
      <p className="text-xs text-muted">Email de connexion : {user.email}</p>
      <FormError message={state.error} />
      <div className="flex items-center gap-3"><SubmitButton size="sm" variant="secondary">Enregistrer</SubmitButton>{state.ok && <span className="text-sm text-green">Enregistré</span>}</div>
    </form>
  );
}

const PREFS: Array<[keyof NotificationPreference, string]> = [
  ["contactRequests", "Nouvelle demande de client"],
  ["reviews", "Nouvel avis"],
  ["changes", "Modification mise en ligne"],
  ["recaps", "Récap du mois"],
  ["messages", "Message de l’équipe"],
  ["documents", "Nouveau document"],
  ["offers", "Offres et promos"],
];

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPreference | null }) {
  const get = (k: keyof NotificationPreference) => (prefs ? Boolean(prefs[k]) : true);
  return (
    <form action={updateNotificationPrefs} className="rounded-card border border-border bg-surface">
      <div className="grid grid-cols-2 gap-px border-b border-border">
        <Toggle name="pushEnabled" label="Sur mon téléphone" defaultChecked={get("pushEnabled")} />
        <Toggle name="emailEnabled" label="Par email" defaultChecked={get("emailEnabled")} />
      </div>
      <div className="divide-y divide-border">
        {PREFS.map(([k, label]) => <Toggle key={k} name={k} label={label} defaultChecked={get(k)} />)}
      </div>
      <div className="p-4"><SubmitButton size="sm" variant="secondary">Enregistrer</SubmitButton></div>
    </form>
  );
}


export function LogoClientForm({ editable, hasLogo }: { editable: boolean; hasLogo: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadLogoClient, {});
  if (!editable) return <p className="text-sm text-text">{hasLogo ? "Votre logo" : "Pas encore de logo"}</p>;
  return (
    <form action={action} className="min-w-0 flex-1">
      <label className="inline-flex h-9 cursor-pointer items-center rounded-card border border-border px-3 text-sm font-semibold text-title hover:bg-surface-2">
        {pending ? "Envoi…" : hasLogo ? "Changer le logo" : "Ajouter votre logo"}
        <input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      </label>
      <p className="mt-1 text-xs text-text">PNG, JPG, SVG ou WebP, 5 Mo max.</p>
      <FormError message={state.error} />
    </form>
  );
}
export function OptOutForm({ optOut }: { optOut: boolean }) {
  return (
    <form action={setOptOutCommercial} className="mt-3 rounded-card border border-border bg-surface">
      <Toggle name="optOut" label="Ne pas recevoir de messages commerciaux (nouveautés, offres). Les messages liés à votre site continuent." defaultChecked={optOut} />
      <div className="px-4 pb-3"><SubmitButton size="sm" variant="secondary" pendingLabel="…">Enregistrer</SubmitButton></div>
    </form>
  );
}
