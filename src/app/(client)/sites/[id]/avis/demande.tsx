"use client";

import { useActionState } from "react";
import { CheckIcon } from "lucide-react";
import { demanderModuleAvis, type DemandeState } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormError } from "@/components/ui/field";

/** Bouton « Débloquer » : la demande part dans les commandes de l'équipe Acco. */
export function DemandeAvis({ siteId, enCours, depuis }: { siteId: string; enCours: boolean; depuis: string | null }) {
  const [state, action] = useActionState<DemandeState, FormData>(demanderModuleAvis.bind(null, siteId), {});
  if (enCours || state.ok) {
    return (
      <div className="mt-5 rounded-card border border-green/40 bg-green/10 p-3 text-left">
        <p className="flex items-center gap-2 text-sm font-semibold text-title"><CheckIcon size={16} className="text-green" /> Demande envoyée{depuis ? ` le ${depuis}` : ""}</p>
        <p className="mt-1 text-xs text-text">L’équipe Acco vous recontacte pour installer la plaquette. Le module s’ouvrira ici dès qu’il sera activé.</p>
      </div>
    );
  }
  return (
    <form action={action} className="mt-5">
      <SubmitButton className="w-full" pendingLabel="Envoi…">Débloquer avec la plaquette avis Google</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
