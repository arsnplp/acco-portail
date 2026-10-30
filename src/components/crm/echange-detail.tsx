"use client";

import { ExternalLinkIcon, MailIcon, PhoneIncomingIcon, PhoneMissedIcon, PhoneOutgoingIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDuree, isAircallMeta, isGmailMeta, type AircallMeta, type GmailMeta } from "@/lib/echange-meta";

export { isAircallMeta, isGmailMeta };

const SENTIMENT: Record<string, { label: string; cls: string }> = {
  POSITIVE: { label: "Positif", cls: "border-green/40 bg-green/10 text-green" },
  NEGATIVE: { label: "Négatif", cls: "border-pink/40 bg-pink/10 text-pink" },
  NEUTRAL: { label: "Neutre", cls: "border-border bg-surface-2 text-text" },
};

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

/** Détail d'un appel Aircall : lecteur, résumé IA, sujets, sentiment, transcription. */
export function AircallBloc({ echangeId, m, compact = false }: { echangeId: string; m: AircallMeta; compact?: boolean }) {
  const s = m.sentiment ? SENTIMENT[m.sentiment] ?? { label: m.sentiment, cls: "border-border text-text" } : null;
  return (
    <div className={cn("mt-2 space-y-2 rounded-card border border-border bg-surface-2/60 p-3", compact && "p-2.5")}>
      {m.enregistrement && (
        // Le lien Aircall expire : la route demande un lien frais puis redirige dessus.
        <audio controls preload="none" src={`/api/crm/aircall/enregistrement/${echangeId}`} className="h-9 w-full" aria-label="Enregistrement de l’appel" />
      )}
      {m.messagerie && !m.enregistrement && <p className="text-xs text-text">Message vocal laissé (écoutable dans Aircall).</p>}
      {m.resume ? (
        <p className="flex gap-2 text-sm text-text-strong"><SparklesIcon size={14} className="mt-0.5 shrink-0 text-claude" aria-hidden /><span className="whitespace-pre-line">{m.resume}</span></p>
      ) : m.analysePending ? (
        <p className="flex items-center gap-2 text-xs text-muted"><SparklesIcon size={12} className="text-claude" aria-hidden /> Analyse IA Aircall en cours (elle arrive quelques minutes après l’appel).</p>
      ) : null}
      {(m.sujets.length > 0 || s) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {s && <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", s.cls)}>{s.label}</span>}
          {m.sujets.map((t) => <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text">{t}</span>)}
        </div>
      )}
      {m.transcription && !compact && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-text hover:text-title">Transcription ({m.transcription.length} prises de parole)</summary>
          <ol className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1 text-xs">
            {m.transcription.map((u, i) => (
              <li key={i} className={cn("flex gap-2", u.qui === "nous" ? "text-text-strong" : "text-text")}>
                <span className={cn("w-14 shrink-0 font-semibold", u.qui === "nous" ? "text-blue" : "text-yellow")}>{u.qui === "nous" ? "Nous" : "Prospect"}</span>
                <span>{u.texte}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
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
