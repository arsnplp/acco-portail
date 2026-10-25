"use client";

import { useActionState, useState } from "react";
import { CheckIcon, HistoryIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { syncSearchConsole, type SyncState } from "../actions";
import { Input, FormError } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

/**
 * « Synchroniser » Search Console : vert si le mois écoulé est déjà là et le récap automatique actif, orange sinon.
 * Une synchro réussie active l'envoi automatique du récap chaque mois.
 */
export function SyncSearchConsoleForm({ siteId, synced }: { siteId: string; synced: boolean }) {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncSearchConsole.bind(null, siteId), {});
  return (
    <div className="space-y-1">
      <form action={action} className="flex items-end gap-2">
        <label className="text-xs text-text">Mois à récupérer<Input name="months" inputMode="numeric" defaultValue={12} className="mt-1 w-20 py-2 text-sm" /></label>
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
            synced ? "border-[#199e70]/60 bg-[#199e70]/15 text-[#3fd39c] hover:bg-[#199e70]/25" : "border-[#d95926]/60 bg-[#d95926]/15 text-[#f08a5d] hover:bg-[#d95926]/25",
          )}
        >
          {pending ? <RefreshCwIcon size={15} className="animate-spin" aria-hidden /> : synced ? <CheckIcon size={15} aria-hidden /> : <RefreshCwIcon size={15} aria-hidden />}
          {pending ? "Synchro…" : synced ? "Synchronisé" : "Synchroniser"}
        </button>
      </form>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
    </div>
  );
}

export type Envoi = { mois: string; sentAt: string | null; clicks: number };

/** Petit bouton : historique des récaps envoyés au client et date du prochain envoi. */
export function RecapHistory({ envois, prochain, auto }: { envois: Envoi[]; prochain: string; auto: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-text-strong hover:border-text hover:text-title">
        <HistoryIcon size={15} aria-hidden /> Envois
      </button>
      {open && (
        <Dialog title="Récaps mensuels envoyés" onClose={() => setOpen(false)}>
          <div className={cn("mb-4 flex items-center gap-3 rounded-card border p-3", auto ? "border-[#199e70]/50 bg-[#199e70]/10" : "border-[#d95926]/50 bg-[#d95926]/10")}>
            <SendIcon size={18} className={auto ? "text-[#3fd39c]" : "text-[#f08a5d]"} aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-title">{auto ? `Prochain envoi : ${prochain}` : "Envoi automatique pas encore actif"}</p>
              <p className="text-xs text-text">{auto ? "Le récap part tout seul le 4 de chaque mois à 8 h, avec les chiffres du mois écoulé." : "Il s’active à la première synchronisation réussie avec Google."}</p>
            </div>
          </div>
          {envois.length === 0 ? (
            <p className="text-sm text-text">Aucun récap pour l’instant.</p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border">
              {envois.map((e) => (
                <li key={e.mois} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="font-medium capitalize text-title">{e.mois}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-text">{e.clicks} clic{e.clicks > 1 ? "s" : ""}</span>
                    {e.sentAt ? <span className="rounded-full bg-[#199e70]/15 px-2.5 py-1 text-xs text-[#3fd39c]">Envoyé le {e.sentAt}</span> : <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text">Non envoyé</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </>
  );
}
