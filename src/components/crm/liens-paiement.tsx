"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, CreditCardIcon, ExternalLinkIcon } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { CLIENT_REFERENCE, OFFRES, euroHT } from "@/lib/liens-paiement";

/** Copie dans le presse-papiers avec un retour visuel de deux secondes. */
function useCopie() {
  const [copie, setCopie] = useState<string | null>(null);
  useEffect(() => { if (!copie) return; const t = setTimeout(() => setCopie(null), 2000); return () => clearTimeout(t); }, [copie]);
  const copier = async (url: string) => {
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copiez le lien :", url); }
    setCopie(url);
  };
  return { copie, copier };
}

/** Liens de paiement Stripe : offres puis paliers « client référence ». Un clic copie le lien ; le petit bouton l'ouvre. */
export function LiensPaiement({ compact = false }: { compact?: boolean }) {
  const { copie, copier } = useCopie();
  const [q, setQ] = useState("");
  const paliers = CLIENT_REFERENCE.filter((p) => !q || String(p.prix).startsWith(q.replace(/\D/g, "")));
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-title">Offres</h3>
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {OFFRES.map((o) => (
            <li key={o.url} className="flex items-center gap-3 px-3 py-2.5">
              <button type="button" onClick={() => copier(o.url)} className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold text-title">{o.nom} <span className="font-normal text-text">· {euroHT(o.prix)}</span></span>
                {!compact && <span className="block truncate text-xs text-text">{o.detail}</span>}
              </button>
              <button type="button" onClick={() => copier(o.url)} className={cn("flex h-9 items-center gap-1.5 rounded-card border px-3 text-xs font-semibold", copie === o.url ? "border-green bg-green/10 text-green" : "border-border text-title hover:border-text")}>
                {copie === o.url ? <><CheckIcon size={14} /> Copié</> : <><CopyIcon size={14} /> Copier</>}
              </button>
              <a href={o.url} target="_blank" rel="noreferrer" aria-label="Ouvrir le lien" className="flex size-9 items-center justify-center rounded-card border border-border text-text hover:text-title"><ExternalLinkIcon size={14} /></a>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-title">Client référence</h3>
          <span className="text-xs text-text">de 70 à 500 € HT/mois, par palier de 10 € · touchez un montant pour copier son lien</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" placeholder="Montant…" className="ml-auto h-8 w-24 rounded-card border border-border bg-surface px-2 text-sm text-title outline-none focus:border-text" />
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-9">
          {paliers.map((p) => (
            <button key={p.url} type="button" onClick={() => copier(p.url)} title={`Copier le lien ${p.prix} € HT/mois`}
              className={cn("flex h-10 items-center justify-center gap-1 rounded-card border text-sm font-semibold tabular-nums", copie === p.url ? "border-green bg-green/10 text-green" : "border-border bg-surface text-title hover:border-text")}>
              {copie === p.url ? <CheckIcon size={13} /> : null}{p.prix} €
            </button>
          ))}
          {paliers.length === 0 && <p className="col-span-full text-sm text-text">Aucun palier ne commence par « {q} ».</p>}
        </div>
      </section>
      <p className="text-xs text-muted">Montants hors taxes, facturés chaque mois par Stripe. Le lien copié se colle dans un SMS, un mail ou WhatsApp.</p>
    </div>
  );
}

/** Bouton d'accès rapide (fiche prospect, en RDV) : ouvre les liens dans une fenêtre. */
export function LiensPaiementButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Liens de paiement Stripe" aria-label="Liens de paiement" className={className ?? "flex h-11 items-center gap-2 rounded-card border border-border px-3 text-sm text-text-strong hover:border-text hover:text-title"}>
        <CreditCardIcon size={16} aria-hidden /> <span className="hidden sm:inline">Liens de paiement</span>
      </button>
      {open && <Dialog title="Liens de paiement" size="lg" onClose={() => setOpen(false)}><LiensPaiement compact /></Dialog>}
    </>
  );
}
