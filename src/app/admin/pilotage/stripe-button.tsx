"use client";

import { useState, useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { actualiserStripe } from "./actions";

/** Bouton violet « Actualiser Stripe » : lance la synchronisation et affiche le résultat sous le bouton. */
export function StripeButton({ derniereSync }: { derniereSync: string | null }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setRes(await actualiserStripe()))}
        className="inline-flex h-9 items-center gap-2 rounded-card bg-violet px-3 text-sm font-semibold text-white transition-colors hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCwIcon size={15} strokeWidth={2} className={cn(pending && "animate-spin")} aria-hidden />
        {pending ? "Actualisation…" : "Actualiser Stripe"}
      </button>
      <p className={cn("text-xs", res ? (res.ok ? "text-green" : "text-pink") : "text-muted")}>{res ? res.message : derniereSync ? `Dernière actualisation : ${derniereSync}` : "Jamais actualisé"}</p>
    </div>
  );
}
