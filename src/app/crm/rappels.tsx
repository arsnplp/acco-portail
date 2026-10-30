"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRingIcon, PhoneIcon, XIcon } from "lucide-react";
import { fmtTime } from "@/lib/crm";

type Rappel = { id: string; at: string; nom: string; societe: string; telephone: string | null };
const key = (r: Rappel) => `acco-rappel:${r.id}:${r.at}`;
const seen = (r: Rappel) => { try { return localStorage.getItem(key(r)) === "1"; } catch { return false; } };

/** Bandeau de rappel en haut de l'écran, même en pleine session d'appels (vérifié toutes les 30 s). */
export function Rappels() {
  const [items, setItems] = useState<Rappel[]>([]);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/rappels", { cache: "no-store" });
      if (!res.ok) return;
      const { rappels } = (await res.json()) as { rappels: Rappel[] };
      setItems(rappels.filter((r) => !seen(r)));
    } catch { /* hors ligne : on réessaiera */ }
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(first); clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);
  const dismiss = (r: Rappel) => { try { localStorage.setItem(key(r), "1"); } catch { /* navigation privée */ } setItems((x) => x.filter((i) => i.id !== r.id)); };

  if (!items.length) return null;
  return (
    <div className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3" style={{ top: "calc(env(safe-area-inset-top) + 64px)" }} role="status">
      {items.slice(0, 3).map((r) => (
        <div key={r.id} className="flex w-full max-w-lg items-center gap-3 rounded-card border border-yellow/50 bg-surface px-4 py-3 shadow-2xl shadow-black/60">
          <BellRingIcon size={20} className="shrink-0 animate-pulse text-yellow" aria-hidden />
          <Link href={`/crm/prospects/${r.id}`} onClick={() => dismiss(r)} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-title">Rappel {fmtTime(r.at)} : {r.nom}</p>
            <p className="truncate text-xs text-yellow/80">{r.nom !== r.societe ? r.societe : "Relance prévue"}</p>
          </Link>
          {r.telephone && <a href={`tel:${r.telephone.replace(/\s/g, "")}`} onClick={() => dismiss(r)} aria-label="Appeler" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-yellow text-bg"><PhoneIcon size={16} /></a>}
          <button type="button" onClick={() => dismiss(r)} aria-label="Fermer le rappel" className="flex size-8 shrink-0 items-center justify-center rounded-full text-yellow/80 hover:text-title"><XIcon size={16} /></button>
        </div>
      ))}
    </div>
  );
}
