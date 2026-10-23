"use client";

import { useActionState } from "react";
import type { ProjectStep, SiteStatus } from "@prisma/client";
import { updateSite, addHistoryEntry, type ActionState } from "../actions";
import { Field, Input, Select, Textarea, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionTitle } from "@/components/ui/card";
import { PROJECT_STEPS } from "@/lib/labels";
import { PlusIcon, SettingsIcon } from "lucide-react";

type SiteInfo = { id: string; name: string; url: string | null; previewUrl: string | null; screenshotUrl: string | null; status: SiteStatus; projectStep: ProjectStep; searchConsoleProp: string | null; googleLocationId: string | null; repoUrl: string | null; repoBranch: string | null; repoRoot: string | null };

export function SiteForms({ site, properties = [], locations = [] }: { site: SiteInfo; properties?: string[]; locations?: { id: string; title: string; address?: string }[] }) {
  const [s1, a1] = useActionState<ActionState, FormData>(updateSite.bind(null, site.id), {});
  const [s2, a2] = useActionState<ActionState, FormData>(addHistoryEntry.bind(null, site.id), {});
  return (
    <>
      <SectionTitle icon={SettingsIcon}>Paramètres du site</SectionTitle>
      <form action={a1} className="space-y-3 rounded-card border border-border bg-surface p-4">
        <Field label="Nom"><Input name="name" defaultValue={site.name} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Statut">
            <Select name="status" defaultValue={site.status}>
              <option value="EN_CREATION">En création</option>
              <option value="EN_LIGNE">En ligne</option>
              <option value="SUSPENDU">Suspendu</option>
            </Select>
          </Field>
          <Field label="Étape du projet">
            <Select name="projectStep" defaultValue={site.projectStep}>
              {PROJECT_STEPS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="URL de production"><Input name="url" defaultValue={site.url ?? ""} placeholder="https://" /></Field>
          <Field label="Lien préprod"><Input name="previewUrl" defaultValue={site.previewUrl ?? ""} placeholder="https://" /></Field>
          <Field label="Propriété Search Console">
            <Input name="searchConsoleProp" list="sc-properties" defaultValue={site.searchConsoleProp ?? ""} placeholder="sc-domain:monsite.fr" />
            <datalist id="sc-properties">{properties.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Fiche Google">
            {locations.length > 0 ? (
              <Select name="googleLocationId" defaultValue={site.googleLocationId ?? ""}><option value="">Aucune</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.title}{l.address ? ` · ${l.address}` : ""}</option>)}</Select>
            ) : (
              <Input name="googleLocationId" defaultValue={site.googleLocationId ?? ""} placeholder="accounts/123/locations/456" />
            )}
          </Field>
        </div>
        <Field label="URL de la capture"><Input name="screenshotUrl" defaultValue={site.screenshotUrl ?? ""} placeholder="https://" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Dépôt GitHub (pour Claude)"><Input name="repoUrl" defaultValue={site.repoUrl ?? ""} placeholder="https://github.com/arsnplp/monsite.git" /></Field>
          <Field label="Branche publiée"><Input name="repoBranch" defaultValue={site.repoBranch ?? ""} placeholder="main" /></Field>
          <Field label="Dossier servi en ligne"><Input name="repoRoot" defaultValue={site.repoRoot ?? ""} placeholder="vide = racine du dépôt" /></Field>
        </div>
        <p className="text-xs text-muted">Passer en « En ligne » enregistre la mise en ligne dans l’historique et prévient le client. Si la propriété Search Console est vide, elle est retrouvée depuis le domaine de l’URL, puis 12 mois de chiffres sont récupérés automatiquement.</p>
        <FormError message={s1.error} />
        <div className="flex items-center gap-3">
          <SubmitButton size="sm">Enregistrer</SubmitButton>
          {s1.ok && <span className="text-sm text-green">Enregistré</span>}
        </div>
      </form>

      <SectionTitle icon={PlusIcon}>Ajouter à l’historique</SectionTitle>
      <form action={a2} className="space-y-3 rounded-card border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type">
            <Select name="kind" defaultValue="INTERVENTION"><option value="INTERVENTION">Intervention</option><option value="CREATION">Récap de création</option></Select>
          </Field>
          <Field label="Date"><Input name="happenedAt" type="date" /></Field>
          <Field label="Titre"><Input name="title" required placeholder="Horaires mis à jour" /></Field>
        </div>
        <Field label="Description" hint="(facultatif)"><Input name="description" /></Field>
        <Field label="Détails" hint="(une ligne par puce)"><Textarea name="items" placeholder={"5 pages créées\nSEO technique\nSitemap"} /></Field>
        <FormError message={s2.error} />
        <div className="flex items-center gap-3">
          <SubmitButton size="sm" variant="secondary">Ajouter</SubmitButton>
          {s2.ok && <span className="text-sm text-green">Ajouté</span>}
        </div>
      </form>
    </>
  );
}
