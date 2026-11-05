"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, FlagIcon, MegaphoneIcon } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { signalerAuCommercial, traiterSignalement } from "@/app/crm/signalement-action";

/** Bouton « Signaler au commercial » (Direction) : à côté d'« Infos du lead » sur la fiche prospect. */
export function SignalerButton({ prospectId, commercial }: { prospectId: string; commercial: string | null }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [etat, setEtat] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const envoyer = () => start(async () => {
    const r = await signalerAuCommercial(prospectId, msg);
    if (r.error) { setEtat(r.error); return; }
    setEtat(null); setMsg(""); setOpen(false); router.refresh();
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={commercial ? `Envoyer une demande à ${commercial}` : "Attribuez d’abord un commercial à la fiche"}
        className="flex h-11 items-center gap-2 rounded-card border border-border px-3 text-sm text-text-strong hover:border-text hover:text-title">
        <FlagIcon size={16} aria-hidden /> <span className="hidden sm:inline">Signaler au commercial</span>
      </button>
      {open && (
        <Dialog title={commercial ? `Signaler à ${commercial}` : "Signaler au commercial"} onClose={() => setOpen(false)}>
          <p className="text-sm text-text">Infos manquantes, erreur sur la fiche, point à vérifier… Votre message arrive dans les Messages {commercial ? `de ${commercial}` : "du commercial"} (et en notification), avec un lien direct vers cette fiche.</p>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} autoFocus placeholder="Ex. : il manque le SIRET et l’email du gérant, et le téléphone semble faux : peux-tu vérifier et corriger la fiche ?"
            className="mt-3 w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-title outline-none focus:border-text" />
          {etat && <p className="mt-2 text-sm text-pink">{etat}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-card border border-border px-3 text-sm text-text hover:text-title">Annuler</button>
            <button type="button" onClick={envoyer} disabled={pending || msg.trim().length < 3} className="h-10 rounded-card bg-title px-4 text-sm font-semibold text-bg disabled:opacity-60">{pending ? "Envoi…" : "Envoyer"}</button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export type SignalementItem = { id: string; message: string; createdAt: string; de: string | null; vers: string | null; versId: string | null };

/** Bandeau sur la fiche : demandes de la Direction non traitées. Le destinataire (ou la Direction) les marque traitées. */
export function SignalementsBanner({ items, meId, direction, surligne }: { items: SignalementItem[]; meId: string; direction: boolean; surligne?: string | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {items.map((s) => (
        <div key={s.id} id={`signalement-${s.id}`} className={cn("flex flex-wrap items-start gap-3 rounded-card border border-yellow/50 bg-yellow/10 px-4 py-3 text-sm", surligne === s.id && "ring-2 ring-yellow")}>
          <MegaphoneIcon size={18} className="mt-0.5 shrink-0 text-yellow" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-yellow">Demande de {s.de ?? "la Direction"}{s.vers ? ` à ${s.vers}` : ""} · {s.createdAt}</p>
            <p className="mt-0.5 whitespace-pre-line text-text-strong">{s.message}</p>
          </div>
          {(s.versId === meId || direction) && (
            <button type="button" disabled={pending} onClick={() => start(async () => { await traiterSignalement(s.id); router.refresh(); })}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-card border border-yellow/60 px-3 text-xs font-semibold text-yellow hover:bg-yellow/15 disabled:opacity-60">
              <CheckIcon size={14} aria-hidden /> {s.versId === meId ? "C’est fait" : "Marquer traité"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
