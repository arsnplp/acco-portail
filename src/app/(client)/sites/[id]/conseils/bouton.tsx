"use client";

import { useState, useTransition } from "react";
import { SparklesIcon } from "lucide-react";
import { personnaliserConseilsAction } from "../actions";

export function ConseilsIaButton({ siteId }: { siteId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await personnaliserConseilsAction(siteId); setErr(r.error || null); })} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text disabled:opacity-50"><SparklesIcon size={14} aria-hidden /> {pending ? "Rédaction…" : "Personnaliser ces conseils"}</button>
      {err && <p className="mt-1 text-xs text-pink">{err}</p>}
    </div>
  );
}
