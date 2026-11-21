"use client";

import { useActionState } from "react";
import { FormError, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { traiterDifficulte, type DifficulteAdminState } from "./actions";

/** Boutons de traitement d'une difficulté (Production et fiche client) : réponse + état en un clic. */
export function TraiterDifficulteForm({ id, statut, reponse }: { id: string; statut: string; reponse: string | null }) {
  const [state, action] = useActionState<DifficulteAdminState, FormData>(traiterDifficulte.bind(null, id), {});
  return (
    <form action={action} className="mt-2 space-y-2">
      <Textarea name="reponse" defaultValue={reponse ?? ""} placeholder="Réponse visible du client (facultative) : ce qui a été fait, ce qu’il doit faire…" className="min-h-14 text-sm" />
      <div className="flex flex-wrap gap-2">
        {statut === "RECUE" && <SubmitButton size="sm" name="statut" value="EN_COURS" pendingLabel="…">Prendre en charge</SubmitButton>}
        {statut !== "RESOLUE" && <SubmitButton size="sm" variant={statut === "RECUE" ? "secondary" : "primary"} name="statut" value="RESOLUE" pendingLabel="…">Marquer résolue</SubmitButton>}
        {statut === "EN_COURS" && <SubmitButton size="sm" variant="secondary" name="statut" value="EN_COURS" pendingLabel="…">Envoyer la réponse</SubmitButton>}
        {statut === "RESOLUE" && <SubmitButton size="sm" variant="secondary" name="statut" value="EN_COURS" pendingLabel="…">Rouvrir</SubmitButton>}
      </div>
      <FormError message={state.error} />
      {state.ok && <p className="text-xs text-green">{state.ok}</p>}
    </form>
  );
}
