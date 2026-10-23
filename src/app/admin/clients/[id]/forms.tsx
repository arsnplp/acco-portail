"use client";

import { useActionState } from "react";
import { updateClient, createSite, createSubscription, type ActionState } from "../actions";
import { Field, Input, Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionTitle } from "@/components/ui/card";
import { SettingsIcon } from "lucide-react";

type ClientInfo = { id: string; name: string; address: string | null; phone: string | null; email: string | null; siren: string | null };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-card border border-border bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-title">{title}</summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

export function ClientForms({ client, sites }: { client: ClientInfo; sites: { id: string; name: string }[] }) {
  const [s1, a1] = useActionState<ActionState, FormData>(updateClient.bind(null, client.id), {});
  const [s2, a2] = useActionState<ActionState, FormData>(createSite.bind(null, client.id), {});
  const [s4, a4] = useActionState<ActionState, FormData>(createSubscription.bind(null, client.id), {});

  return (
    <>
      <SectionTitle icon={SettingsIcon}>Gérer</SectionTitle>
      <div className="grid gap-2">
        <Panel title="Ajouter un site">
          <form action={a2} className="space-y-3">
            <Field label="Nom du site"><Input name="name" placeholder="monsite.fr" required /></Field>
            <FormError message={s2.error} />
            <SubmitButton size="sm">Créer le site (en création)</SubmitButton>
          </form>
        </Panel>
        <Panel title="Ajouter un abonnement ou un module">
          <form action={a4} className="space-y-3">
            <Field label="Libellé"><Input name="label" placeholder="Site vitrine — abonnement" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix (€)"><Input name="price" inputMode="decimal" placeholder="49" required /></Field>
              <Field label="Facturation">
                <Select name="billing" defaultValue="MENSUEL"><option value="MENSUEL">Mensuel</option><option value="PONCTUEL">Ponctuel</option></Select>
              </Field>
              <Field label="Site concerné">
                <Select name="siteId" defaultValue=""><option value="">Tous</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </Field>
              <Field label="Quota modifs / mois" hint="(vide = illimité)"><Input name="monthlyQuota" inputMode="numeric" /></Field>
            </div>
            <Field label="Fin d’engagement"><Input name="commitmentEndsAt" type="date" /></Field>
            <FormError message={s4.error} />
            <SubmitButton size="sm">Ajouter</SubmitButton>
          </form>
        </Panel>
        <Panel title="Modifier les informations">
          <form action={a1} className="space-y-3">
            <Field label="Nom"><Input name="name" defaultValue={client.name} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone"><Input name="phone" defaultValue={client.phone ?? ""} /></Field>
              <Field label="Email"><Input name="email" type="email" defaultValue={client.email ?? ""} /></Field>
            </div>
            <Field label="Adresse"><Input name="address" defaultValue={client.address ?? ""} /></Field>
            <Field label="SIREN"><Input name="siren" defaultValue={client.siren ?? ""} /></Field>
            <FormError message={s1.error} />
            <SubmitButton size="sm">Enregistrer</SubmitButton>
          </form>
        </Panel>
      </div>
    </>
  );
}
