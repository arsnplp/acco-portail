"use client";

import { useActionState } from "react";
import { syncSearchConsole, type SyncState } from "../actions";
import { Input, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

/** « Synchroniser » Search Console, avec le résultat affiché (mois récupérés ou message d'erreur de Google). */
export function SyncSearchConsoleForm({ siteId }: { siteId: string }) {
  const [state, action] = useActionState<SyncState, FormData>(syncSearchConsole.bind(null, siteId), {});
  return (
    <div className="space-y-1">
      <form action={action} className="flex items-end gap-2">
        <label className="text-xs text-text">Mois à récupérer<Input name="months" inputMode="numeric" defaultValue={12} className="mt-1 w-20 py-2 text-sm" /></label>
        <SubmitButton size="sm" variant="secondary" pendingLabel="Synchro…">Synchroniser</SubmitButton>
      </form>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
    </div>
  );
}
