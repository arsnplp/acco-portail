"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/cn";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Art, type ArtKind } from "../art";
import { demanderCreation, type CreationState } from "../actions";

const FORMATS: { nom: string; detail: string; art: ArtKind }[] = [
  { nom: "Publication", detail: "Carré · 1080 × 1080", art: "create" }, { nom: "Flyer", detail: "A5 · recto", art: "create" }, { nom: "Affiche", detail: "A4", art: "brand" },
  { nom: "Story", detail: "1080 × 1920", art: "create" }, { nom: "Texte de publication", detail: "Légende et idées", art: "strategy" },
];

export function CreerForm() {
  const [format, setFormat] = useState<string | null>(null);
  const [state, action] = useActionState<CreationState, FormData>(demanderCreation, {});
  if (state.ok) return <div className="rounded-card border border-green/40 bg-green/10 p-4 text-sm text-green">{state.ok}</div>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="format" value={format ?? ""} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FORMATS.map((f, i) => (
          <button key={f.nom} type="button" onClick={() => setFormat(f.nom)} aria-pressed={format === f.nom} className={cn("rounded-card border bg-surface p-3 text-left transition-colors", format === f.nom ? "border-title" : "border-border hover:border-text")}>
            <Art kind={f.art} label={`Format / ${i + 1}`} className="h-24" />
            <p className="mt-2 font-semibold text-title">{f.nom}</p>
            <p className="text-xs text-text">{f.detail}</p>
          </button>
        ))}
      </div>
      {format && (
        <div className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-lg font-bold text-title">Créer : {format}.</h2>
          <p className="mb-3 text-sm text-text">Votre univers de marque sera appliqué. Décrivez votre idée, votre équipe ACCO vous propose une création.</p>
          <Field label="Titre du support"><Input name="titre" required placeholder="Ex. Collection de Noël" /></Field>
          <div className="mt-3"><Field label="Décrivez votre idée"><Textarea name="idee" required placeholder="Message, style, offre, dates…" className="min-h-24" /></Field></div>
          <FormError message={state.error} />
          <SubmitButton className="mt-3 w-full" pendingLabel="Envoi…">Demander cette création</SubmitButton>
        </div>
      )}
    </form>
  );
}
