"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EchangeType, ProspectStatut } from "@prisma/client";
import { ChevronDownIcon, HeadphonesIcon, PhoneIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/crm/logo";
import { DateInput, TimeInput } from "@/components/ui/date-time";
import { AircallBloc, AircallTitre, GmailBloc, isAircallMeta, isGmailMeta } from "@/components/crm/echange-detail";
import type { AircallMeta } from "@/lib/echange-meta";
import { ECHANGE, MOTIFS_ABANDON, MOTIFS_PERTE, SEQUENCE_APPELS, STATUT, TOUS_STATUTS, fmtDayTime, fmtTime, initialsOf, logoUrl, relanceInfo } from "@/lib/crm";
import { bulkProspects, type BulkInput } from "../actions";

export type Row = {
  id: string; societe: string; contact: string | null; telephone: string | null; siteWeb: string | null; statut: ProspectStatut; relanceAt: string | null; rappelAt: string | null;
  commercialId: string | null; cible: string | null; motif: string | null; appels: number; updatedAt: string; client: boolean;
  derniers: { id: string; type: EchangeType; date: string; notes: string | null; origine: string; auteur: string | null; meta: unknown }[];
  enregistrements: { id: string; date: string; meta: AircallMeta }[];
};
type Member = { id: string; name: string };

/** Jauge de la séquence d'appels : 5 crans (NRP + appels + prises de RDV), verte quand la séquence est faite. */
function Sequence({ n }: { n: number }) {
  const done = n >= SEQUENCE_APPELS;
  return (
    <span title={`${n} appel${n > 1 ? "s" : ""} (NRP, appels, prises de RDV) · séquence de ${SEQUENCE_APPELS}`} className={cn("inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums", done ? "text-green" : n ? "text-yellow" : "text-muted")}>
      <PhoneIcon size={11} aria-hidden />
      <span className="flex gap-[2px]" aria-hidden>{Array.from({ length: SEQUENCE_APPELS }, (_, i) => <span key={i} className={cn("h-2 w-1.5 rounded-[2px]", i < n ? (done ? "bg-green" : "bg-yellow") : "bg-surface-2")} />)}</span>
      {n > SEQUENCE_APPELS ? `${SEQUENCE_APPELS}+` : n}
    </span>
  );
}

export function Liste({ rows, team, isAdmin }: { rows: Row[]; team: Member[]; isAdmin: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<"statut" | "relance" | "commercial">("statut");
  const [statut, setStatut] = useState<ProspectStatut>("A_RELANCER");
  const [motif, setMotif] = useState("");
  const [relance, setRelance] = useState("");
  const [commercial, setCommercial] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const members = new Map(team.map((m) => [m.id, m.name]));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));

  function appliquer(fd: FormData) {
    const input: BulkInput = action === "statut" ? { statut, motif: statut === "PERDU" || statut === "ABANDON" ? motif || null : null }
      : action === "relance" ? { relance: relance || null, relanceHeure: String(fd.get("relanceHeure") ?? "") || null }
      : { commercialId: commercial || null };
    start(async () => {
      const r = await bulkProspects([...sel], input);
      setMsg(r.error ?? `${r.ok} fiche${(r.ok ?? 0) > 1 ? "s" : ""} mise${(r.ok ?? 0) > 1 ? "s" : ""} à jour.`);
      if (!r.error) { setSel(new Set()); router.refresh(); }
    });
  }

  const input = "h-10 rounded-card border border-border bg-surface px-3 text-sm text-title outline-none";
  return (
    <>
      {sel.size > 0 && (
        <form action={appliquer} className="sticky top-14 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-card border border-yellow/40 bg-[#2a2615] p-3 text-sm">
          <span className="font-semibold text-title">{sel.size} sélectionnée{sel.size > 1 ? "s" : ""}</span>
          <select value={action} onChange={(e) => setAction(e.target.value as typeof action)} className={input} aria-label="Action">
            <option value="statut">Changer le statut</option><option value="relance">Changer la date de relance</option>{isAdmin && <option value="commercial">Réattribuer</option>}
          </select>
          {action === "statut" && (
            <>
              <select value={statut} onChange={(e) => setStatut(e.target.value as ProspectStatut)} className={input} aria-label="Nouveau statut">{TOUS_STATUTS.map((s) => <option key={s} value={s}>{STATUT[s].label}</option>)}</select>
              {(statut === "PERDU" || statut === "ABANDON") && <select value={motif} onChange={(e) => setMotif(e.target.value)} className={input} aria-label="Motif"><option value="">Motif…</option>{(statut === "PERDU" ? MOTIFS_PERTE : MOTIFS_ABANDON).map((m) => <option key={m}>{m}</option>)}</select>}
              {statut === "RDV_POSE" && <span className="text-xs text-yellow/80">La date de relance sera effacée.</span>}
            </>
          )}
          {action === "relance" && (
            <>
              <DateInput name="relance" value={relance} onChange={setRelance} label="Date de relance" className="w-40 [&_input]:py-2 [&_input]:text-sm" />
              <TimeInput name="relanceHeure" optional label="Heure de rappel (facultative)" className="w-32 [&_input]:py-2 [&_input]:text-sm" />
              <span className="text-xs text-yellow/80">Vide = retirer la relance.</span>
            </>
          )}
          {action === "commercial" && <select value={commercial} onChange={(e) => setCommercial(e.target.value)} className={input} aria-label="Commercial"><option value="">Personne</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
          <button type="submit" disabled={pending} className="h-10 rounded-card bg-title px-4 font-semibold text-bg disabled:opacity-60">{pending ? "Application…" : "Appliquer"}</button>
          <button type="button" onClick={() => setSel(new Set())} className="px-2 text-text hover:text-title">Tout désélectionner</button>
        </form>
      )}
      {msg && <p className={cn("mt-3 text-sm", /Sélectionnez|Seuls|Choisissez|inconnu/.test(msg) ? "text-pink" : "text-green")}>{msg}</p>}

      <div className="mt-4 overflow-hidden rounded-card border border-border bg-surface">
        <div className="hidden items-center gap-3 border-b border-border px-3 py-2 text-[11px] font-semibold tracking-wide text-text uppercase sm:flex">
          <input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Tout sélectionner" className="size-4 accent-white" />
          <span className="flex-1">Prospect</span><span className="w-28">Statut</span><span className="w-24">Appels</span><span className="w-28">Relance</span><span className="w-40">Dernier échange</span><span className="w-8" />
        </div>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-text">Aucune fiche avec ces filtres.</p>}
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const rel = relanceInfo(r.relanceAt), last = r.derniers[0], isOpen = open.has(r.id);
            return (
              <li key={r.id} className={cn(sel.has(r.id) && "bg-surface-2/60")}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Sélectionner ${r.societe}`} className="size-4 shrink-0 accent-white" />
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-[10px] font-semibold text-text-strong"><Logo src={logoUrl(r.siteWeb)} name={r.societe} className="size-5" /></span>
                  <Link href={`/crm/prospects/${r.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-title">{r.contact ?? r.societe}</span>
                    <span className="block truncate text-xs text-text">{[r.contact ? r.societe : null, r.cible, r.commercialId ? members.get(r.commercialId) : "sans commercial", r.motif].filter(Boolean).join(" · ")}</span>
                  </Link>
                  <span className="hidden w-28 sm:block"><Badge tone={STATUT[r.statut].tone}>{STATUT[r.statut].label}</Badge></span>
                  <span className="hidden w-24 sm:block"><Sequence n={r.appels} /></span>
                  <span className={cn("hidden w-28 truncate text-xs sm:block", rel.state === "late" ? "text-pink" : rel.state === "today" ? "text-yellow" : "text-text")}>{rel.label}{r.rappelAt ? ` ${fmtTime(r.rappelAt)}` : ""}</span>
                  <span className="hidden w-40 truncate text-xs text-text sm:block">{last ? `${isAircallMeta(last.meta) ? "Appel Aircall" : isGmailMeta(last.meta) ? "Mail" : ECHANGE[last.type].short} · ${fmtDayTime(last.date)}` : "—"}</span>
                  <button type="button" onClick={() => toggleOpen(r.id)} aria-expanded={isOpen} aria-label="Notes et enregistrements" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-text hover:text-title", r.enregistrements.length > 0 && "text-green")}>
                    {r.enregistrements.length ? <HeadphonesIcon size={14} /> : <ChevronDownIcon size={14} className={cn("transition-transform", isOpen && "rotate-180")} />}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-3 pb-2 sm:hidden">
                  <Badge tone={STATUT[r.statut].tone}>{STATUT[r.statut].label}</Badge><Sequence n={r.appels} />
                  <span className={cn("text-xs", rel.state === "late" ? "text-pink" : "text-text")}>{rel.label}</span>
                  {r.commercialId && <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-text-strong">{initialsOf(members.get(r.commercialId) ?? "?")}</span>}
                </div>
                {isOpen && (
                  <div className="space-y-3 border-t border-border bg-bg/40 px-4 py-3">
                    {r.derniers.length === 0 && <p className="text-xs text-text">Aucun échange noté.</p>}
                    {r.derniers.map((e) => {
                      const call = isAircallMeta(e.meta) ? e.meta : null, mail = isGmailMeta(e.meta) ? e.meta : null;
                      return (
                        <div key={e.id} className="text-sm">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-text">
                            <span className="font-semibold text-text-strong">{call && e.origine === "aircall" ? "Appel Aircall" : mail ? (mail.direction === "recu" ? "Mail reçu" : "Mail envoyé") : ECHANGE[e.type].short}</span>
                            {call && <AircallTitre m={call} />}<span>{fmtDayTime(e.date)}</span>{e.auteur && !(call && e.origine === "aircall") && <span>· {e.auteur}</span>}
                          </p>
                          {e.notes && e.origine !== "aircall" && !mail && <p className="mt-0.5 whitespace-pre-line text-text-strong">{e.notes.length > 400 ? e.notes.slice(0, 400) + "…" : e.notes}</p>}
                          {call && <AircallBloc echangeId={e.id} m={call} compact />}
                          {mail && <GmailBloc m={mail} />}
                        </div>
                      );
                    })}
                    {r.enregistrements.filter((x) => !r.derniers.some((d) => d.id === x.id)).length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-text">Autres enregistrements</p>
                        <div className="space-y-2">
                          {r.enregistrements.filter((x) => !r.derniers.some((d) => d.id === x.id)).slice(0, 5).map((x) => (
                            <div key={x.id} className="text-sm"><p className="text-xs text-text"><AircallTitre m={x.meta} /> · {fmtDayTime(x.date)}</p><AircallBloc echangeId={x.id} m={x.meta} compact /></div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Link href={`/crm/prospects/${r.id}`} className="inline-block text-xs font-semibold text-title hover:underline">Ouvrir la fiche</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
