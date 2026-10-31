"use client";

import { useState, useTransition } from "react";
import { CalendarSyncIcon } from "lucide-react";
import { syncMyAgendaAction } from "./actions";

export function AgendaSyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await syncMyAgendaAction(); setMsg(r.ok ? `Agenda à jour : ${r.rdv} RDV et ${r.echeances} échéance${r.echeances > 1 ? "s" : ""} de sites.` : r.error ?? "Synchronisation impossible."); })}
        className="flex items-center gap-1.5 rounded-card border border-border px-3 py-1.5 text-xs text-title hover:bg-surface-2 disabled:opacity-60">
        <CalendarSyncIcon size={14} className={pending ? "animate-spin" : undefined} aria-hidden /> {pending ? "Synchronisation…" : "Synchroniser mon agenda maintenant"}
      </button>
      {msg && <span className={`text-xs ${/impossible|manquante|expirée|activée/.test(msg) ? "text-pink" : "text-green"}`}>{msg}</span>}
    </div>
  );
}
