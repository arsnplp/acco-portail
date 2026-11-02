"use client";

import { ExternalLinkIcon, MailIcon, PhoneIncomingIcon, PhoneMissedIcon, PhoneOutgoingIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDuree, isAircallMeta, isGmailMeta, type AircallMeta, type GmailMeta } from "@/lib/echange-meta";

export { isAircallMeta, isGmailMeta };

/** Ligne de titre d'un appel Aircall : sens, durée, agent. */
export function AircallTitre({ m }: { m: AircallMeta }) {
  const Icon = !m.repondu ? PhoneMissedIcon : m.direction === "outbound" ? PhoneOutgoingIcon : PhoneIncomingIcon;
  return (
    <span className={cn("inline-flex items-center gap-1", !m.repondu ? "text-pink" : "text-green")}>
      <Icon size={12} aria-hidden />
      {m.repondu ? `${m.direction === "outbound" ? "Sortant" : "Entrant"} · ${fmtDuree(m.dureeSec)}` : m.direction === "outbound" ? "Sans réponse" : "Entrant manqué"}
      {m.agent && <span className="text-text"> · {m.agent}</span>}
    </span>
  );
}

/** Détail d'un appel Aircall : métadonnées seulement (ligne, numéro). Ni enregistrement, ni analyse (00.7). */
export function AircallBloc({ m, compact = false }: { echangeId?: string; m: AircallMeta; compact?: boolean }) {
  return (
    <p className={cn("mt-1 text-xs text-text", compact && "mt-0.5")}>
      {m.ligne ? `Ligne ${m.ligne} · ` : ""}{m.numero}{!m.repondu && m.motifManque ? ` · ${m.motifManque.replace(/_/g, " ")}` : ""}
    </p>
  );
}

/** Détail d'un mail Gmail : objet, extrait, lien pour l'ouvrir. */
export function GmailBloc({ m }: { m: GmailMeta }) {
  return (
    <div className="mt-1 rounded-card border border-border bg-surface-2/60 p-3 text-sm">
      <p className="flex items-start gap-2">
        <MailIcon size={14} className={cn("mt-0.5 shrink-0", m.direction === "recu" ? "text-yellow" : "text-blue")} aria-hidden />
        <span className="min-w-0">
          <span className="block font-semibold text-title">{m.objet}</span>
          <span className="block truncate text-xs text-text">{m.direction === "recu" ? `De ${m.de}` : `À ${m.a}`}</span>
        </span>
      </p>
      {m.extrait && <p className="mt-1.5 text-text-strong">{m.extrait}</p>}
      <a href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(m.boite ?? "")}#all/${m.threadId}`} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-text hover:text-title">Ouvrir dans Gmail{m.boite ? ` (${m.boite})` : ""} <ExternalLinkIcon size={11} /></a>
    </div>
  );
}
