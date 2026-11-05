"use client";

import { ExternalLinkIcon, MailIcon, PhoneIncomingIcon, PhoneMissedIcon, PhoneOutgoingIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDuree, type AircallMeta, type GmailMeta } from "@/lib/echange-meta";

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

/** Détail d'un appel Aircall : lecteur, résumé (Aircall ou Claude), sujets, sentiment, puis ligne et numéro. La transcription n'est pas affichée. */
export function AircallBloc({ echangeId, m, compact = false }: { echangeId: string; m: AircallMeta; compact?: boolean }) {
  const s = m.sentiment ? SENTIMENT[m.sentiment] ?? { label: m.sentiment, cls: "border-border text-text" } : null;
  const sujets = m.sujets ?? [];
  const infos = `${m.ligne ? `Ligne ${m.ligne} · ` : ""}${m.numero}${!m.repondu && m.motifManque ? ` · ${m.motifManque.replace(/_/g, " ")}` : ""}`;
  const riche = m.enregistrement || m.messagerie || m.resume || m.analysePending || sujets.length > 0 || s || m.transcription;
  if (!riche) return <p className={cn("mt-1 text-xs text-text", compact && "mt-0.5")}>{infos}</p>;
  return (
    <div className={cn("mt-2 space-y-2 rounded-card border border-border bg-surface-2/60 p-3", compact && "p-2.5")}>
      {m.enregistrement && (
        // Le lien Aircall expire : la route demande un lien frais puis redirige dessus.
        <audio controls preload="none" src={`/api/crm/aircall/enregistrement/${echangeId}`} className="h-9 w-full" aria-label="Enregistrement de l’appel" />
      )}
      {m.messagerie && !m.enregistrement && <p className="text-xs text-text">Message vocal laissé (écoutable dans Aircall).</p>}
      {m.resume ? (
        <p className="flex gap-2 text-sm text-text-strong" title={m.resumeIA ? "Résumé rédigé par Claude à partir de la transcription Aircall" : "Résumé Aircall"}><SparklesIcon size={14} className="mt-0.5 shrink-0 text-claude" aria-hidden /><span className="whitespace-pre-line">{m.resume}</span></p>
      ) : m.analysePending ? (
        <p className="flex items-center gap-2 text-xs text-muted"><SparklesIcon size={12} className="text-claude" aria-hidden /> Résumé en cours (il arrive quelques minutes après l’appel).</p>
      ) : m.transcription ? (
        <p className="text-xs text-muted">Pas de résumé pour cet appel (résumé IA désactivé ou plafond atteint, Administration → IA et intégrations).</p>
      ) : null}
      {(sujets.length > 0 || s) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {s && <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", s.cls)}>{s.label}</span>}
          {sujets.map((t) => <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text">{t}</span>)}
        </div>
      )}
      <p className="text-[11px] text-muted">{infos}</p>
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
