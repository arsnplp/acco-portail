"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/cn";
import { COULEURS, DENSITES, FORMES, IMAGES, MODES, hexOk, type Charte } from "@/lib/charte";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { deposerPieceCharte, publierCharteSite, saveCharteSite, supprimerPieceCharte, type CharteState } from "./actions";

function Choix({ options, value, onChange }: { options: { key: string; label: string; aide: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => { const on = value === o.key; return <button key={o.key} type="button" onClick={() => onChange(on ? "" : o.key)} aria-pressed={on} title={o.aide} className={cn("inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors", on ? "border-title bg-title text-bg" : "border-border text-title hover:border-text")}>{o.label}</button>; })}
    </div>
  );
}

function Couleur({ label, aide, value, onChange }: { label: string; aide: string; value: string; onChange: (v: string) => void }) {
  const [txt, setTxt] = useState(value);
  const applique = (v: string) => { setTxt(v); if (hexOk(v)) onChange(v.toLowerCase()); if (v === "") onChange(""); };
  return (
    <div className="flex items-center gap-3 rounded-card border border-border p-2">
      <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: value || "transparent" }}>
        <input type="color" value={value || "#888888"} onChange={(e) => applique(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`Couleur ${label}`} />
        {!value && <span className="absolute inset-0 flex items-center justify-center text-muted">+</span>}
      </label>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-title">{label}</p><p className="truncate text-[11px] text-text">{aide}</p></div>
      <input value={txt} onChange={(e) => applique(e.target.value.trim())} placeholder="#000000" maxLength={7} className="w-[92px] rounded-lg border border-border bg-surface px-2 py-1.5 text-center font-mono text-xs text-title outline-none focus:border-blue" aria-label={`Code ${label}`} />
    </div>
  );
}

const S = ({ t, children }: { t: string; children: React.ReactNode }) => <section className="rounded-card border border-border bg-surface p-4"><h3 className="mb-3 text-sm font-semibold text-title">{t}</h3>{children}</section>;

/** Formulaire équipe : tout est facultatif, on note ce qui a réellement été utilisé sur le site. */
export function CharteSiteForm({ siteId, init }: { siteId: string; init: Charte }) {
  const [c, setC] = useState<Charte>(init);
  const [state, action] = useActionState<CharteState, FormData>(saveCharteSite.bind(null, siteId), {});
  const maj = <K extends keyof Charte>(k: K, v: Charte[K]) => setC((p) => ({ ...p, [k]: v }));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="contenu" value={JSON.stringify(c)} />
      <S t="Ambiance">
        <Textarea value={c.ambiance} onChange={(e) => maj("ambiance", e.target.value)} maxLength={600} placeholder="ex. chaleureux et artisanal, épuré et moderne…" className="min-h-16 text-sm" />
      </S>
      <S t="Couleurs">
        <div className="grid gap-2 sm:grid-cols-2">{COULEURS.map((k) => <Couleur key={k.key} label={k.label} aide={k.aide} value={c.couleurs[k.key]} onChange={(v) => maj("couleurs", { ...c.couleurs, [k.key]: v })} />)}</div>
        <Textarea value={c.couleursNote} onChange={(e) => maj("couleursNote", e.target.value)} maxLength={1000} placeholder="Usage de chaque couleur, codes complémentaires, dégradés…" className="mt-2 min-h-14 text-sm" />
      </S>
      <S t="Polices">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Titres"><Input value={c.policeTitres} onChange={(e) => maj("policeTitres", e.target.value)} maxLength={120} placeholder="ex. Poppins" /></Field>
          <Field label="Textes"><Input value={c.policeTextes} onChange={(e) => maj("policeTextes", e.target.value)} maxLength={120} placeholder="ex. Inter" /></Field>
        </div>
        <Textarea value={c.policesNote} onChange={(e) => maj("policesNote", e.target.value)} maxLength={600} placeholder="Graisses, tailles, où la télécharger (Google Fonts…)." className="mt-2 min-h-14 text-sm" />
      </S>
      <div className="grid gap-3 sm:grid-cols-2">
        <S t="Espacements"><Choix options={DENSITES} value={c.densite} onChange={(v) => maj("densite", v)} /></S>
        <S t="Formes"><Choix options={FORMES} value={c.formes} onChange={(v) => maj("formes", v)} /></S>
        <S t="Clair ou sombre"><Choix options={MODES} value={c.mode} onChange={(v) => maj("mode", v)} /></S>
        <S t="Images"><Choix options={IMAGES} value={c.images} onChange={(v) => maj("images", v)} /></S>
      </div>
      <S t="Note pour le client">
        <Textarea value={c.note} onChange={(e) => maj("note", e.target.value)} maxLength={3000} placeholder="Règles d’usage du logo (marges, fond clair / foncé), icônes utilisées, conseils pour rester cohérent sur les réseaux ou les supports imprimés…" className="min-h-20 text-sm" />
      </S>
      <div className="flex flex-wrap items-center gap-3"><SubmitButton size="sm" pendingLabel="…">Enregistrer la charte</SubmitButton><FormError message={state.error} />{state.ok && <span className="text-sm text-green">{state.ok}</span>}</div>
    </form>
  );
}

export function PublierCharteButton({ siteId, publiee }: { siteId: string; publiee: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<CharteState | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await publierCharteSite(siteId, !publiee)))} className={cn("inline-flex h-9 items-center rounded-card px-3 text-sm font-semibold disabled:opacity-50", publiee ? "border border-border text-title hover:border-text" : "bg-title text-bg hover:bg-text-strong")}>{pending ? "…" : publiee ? "Masquer au client" : "Publier pour le client"}</button>
      {msg && <span className={cn("text-xs", msg.error ? "text-pink" : "text-green")}>{msg.error ?? msg.ok}</span>}
    </div>
  );
}

export function DepotPieceCharte({ siteId, kind, label, accept }: { siteId: string; kind: string; label: string; accept: string }) {
  const [state, action] = useActionState<CharteState, FormData>(deposerPieceCharte.bind(null, siteId, kind), {});
  return (
    <form action={action} key={state.ok ?? "f"} className="flex flex-wrap items-end gap-2">
      <Field label={label}><Input type="file" name="file" multiple required accept={accept} className="file:mr-3 file:rounded-sm file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:text-title" /></Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">Déposer</SubmitButton>
      <FormError message={state.error} />{state.ok && <span className="text-sm text-green">{state.ok}</span>}
    </form>
  );
}

export function SupprimerPieceCharteButton({ siteId, id }: { siteId: string; id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Retirer ce fichier ?") && start(() => supprimerPieceCharte(siteId, id))} aria-label="Retirer" className="flex size-8 items-center justify-center rounded-full text-text hover:text-pink disabled:opacity-50"><Trash2Icon size={14} /></button>;
}
