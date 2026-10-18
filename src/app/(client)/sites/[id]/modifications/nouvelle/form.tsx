"use client";

import { useActionState } from "react";
import { Camera } from "lucide-react";
import { createChangeRequest, type ChangeFormState } from "../actions";
import { Field, Input, Textarea, Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SITE_PAGES } from "@/lib/labels";

export function NewChangeForm({ siteId }: { siteId: string }) {
  const [state, action] = useActionState<ChangeFormState, FormData>(createChangeRequest.bind(null, siteId), {});
  return (
    <form action={action} className="space-y-5">
      <Field label="En quelques mots">
        <Input name="title" placeholder="Ex. Changer les horaires d’ouverture" required maxLength={120} />
      </Field>
      <Field label="Détails">
        <Textarea name="description" placeholder="Expliquez ce que vous voulez : nouveau texte, nouvelle photo, ce qui ne va pas…" required />
      </Field>
      <Field label="Page concernée" hint="(facultatif)">
        <Select name="page" defaultValue="">
          <option value="">Je ne sais pas</option>
          {SITE_PAGES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </Field>
      <Field label="Photo ou capture d’écran" hint="(facultatif, 5 max)">
        <label className="flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-border px-4 py-4 text-sm text-text hover:border-text">
          <Camera size={20} strokeWidth={1.5} />
          <span>Ajouter des images ou un document</span>
          <input type="file" name="files" multiple accept="image/*,.pdf" className="sr-only" />
        </label>
      </Field>
      <Field label="Urgence">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-card border border-border px-4 py-3 text-sm has-[:checked]:border-title">
            <input type="radio" name="urgency" value="NORMALE" defaultChecked className="accent-white" /> Quand vous pouvez
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-card border border-border px-4 py-3 text-sm has-[:checked]:border-title">
            <input type="radio" name="urgency" value="URGENTE" className="accent-white" /> Urgent
          </label>
        </div>
      </Field>
      <FormError message={state.error} />
      <SubmitButton size="lg" className="w-full">Envoyer ma demande</SubmitButton>
    </form>
  );
}
