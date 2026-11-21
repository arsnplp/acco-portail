"use client";

import { useActionState, useState, useTransition } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/cn";
import { DENSITES, FORMES, MODES, hexOk, type Charte, type Couleur, type Puce } from "@/lib/charte";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { deposerPieceCharte, publierCharteSite, saveCharteSite, supprimerPieceCharte, type CharteState } from "./actions";

const S = ({ n, t, aide, children }: { n?: string; t: string; aide?: string; children: React.ReactNode }) => (
  <section className="rounded-card border border-border bg-surface p-4">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-title">{n && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">{n}</span>}{t}</h3>
    {aide && <p className="mt-0.5 text-xs text-text">{aide}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

function Choix({ options, value, onChange }: { options: { key: string; label: string; aide: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => { const on = value === o.key; return <button key={o.key} type="button" onClick={() => onChange(on ? "" : o.key)} aria-pressed={on} title={o.aide} className={cn("inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors", on ? "border-title bg-title text-bg" : "border-border text-title hover:border-text")}>{o.label}</button>; })}
    </div>
  );
}

function LigneCouleur({ c, onChange, onRemove }: { c: Couleur; onChange: (c: Couleur) => void; onRemove: () => void }) {
  const [txt, setTxt] = useState(c.hex);
  const applique = (v: string) => { setTxt(v); if (hexOk(v)) onChange({ ...c, hex: v.toLowerCase() }); };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-border p-2">
      <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: c.hex || "transparent" }}>
        <input type="color" value={c.hex || "#888888"} onChange={(e) => applique(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="Choisir la couleur" />
      </label>
      <input value={txt} onChange={(e) => applique(e.target.value.trim())} placeholder="#586B50" maxLength={7} className="w-[92px] rounded-lg border border-border bg-surface px-2 py-1.5 text-center font-mono text-xs text-title outline-none focus:border-blue" aria-label="Code" />
      <input value={c.nom} onChange={(e) => onChange({ ...c, nom: e.target.value })} placeholder="Nom (ex. Vert végétal)" maxLength={60} className="min-w-[140px] flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-title outline-none focus:border-blue" />
      <input value={c.usage} onChange={(e) => onChange({ ...c, usage: e.target.value })} placeholder="Usage (boutons, titres…)" maxLength={120} className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-title outline-none focus:border-blue" />
      <button type="button" onClick={onRemove} aria-label="Retirer" className="flex size-8 items-center justify-center rounded-full text-text hover:text-pink"><Trash2Icon size={14} /></button>
    </div>
  );
}

function ListePuces({ items, onChange, placeholderTitre, placeholderTexte, ajout }: { items: Puce[]; onChange: (p: Puce[]) => void; placeholderTitre: string; placeholderTexte: string; ajout: string }) {
  const maj = (i: number, patch: Partial<Puce>) => onChange(items.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="grid gap-2">
      {items.map((p, i) => (
        <div key={i} className="flex items-start gap-2 rounded-card border border-border p-2">
          <span className="mt-2 font-mono text-[11px] text-text">{String(i + 1).padStart(2, "0")}</span>
          <div className="grid flex-1 gap-1.5">
            <input value={p.titre} onChange={(e) => maj(i, { titre: e.target.value })} placeholder={placeholderTitre} maxLength={120} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm font-semibold text-title outline-none focus:border-blue" />
            <input value={p.texte} onChange={(e) => maj(i, { texte: e.target.value })} placeholder={placeholderTexte} maxLength={600} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-title outline-none focus:border-blue" />
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Retirer" className="mt-1 flex size-8 items-center justify-center rounded-full text-text hover:text-pink"><Trash2Icon size={14} /></button>
        </div>
      ))}
      {items.length < 12 && <button type="button" onClick={() => onChange([...items, { titre: "", texte: "" }])} className="inline-flex h-8 w-fit items-center gap-1 rounded-full border border-border px-3 text-xs text-title hover:border-text"><PlusIcon size={13} /> {ajout}</button>}
    </div>
  );
}

/** Formulaire équipe : tout est facultatif, on note ce qui a réellement été utilisé sur le site. */
export function CharteSiteForm({ siteId, init }: { siteId: string; init: Charte }) {
  const [c, setC] = useState<Charte>(init);
  const [adj, setAdj] = useState(init.adjectifs.join(", "));
  const [state, action] = useActionState<CharteState, FormData>(saveCharteSite.bind(null, siteId), {});
  const maj = <K extends keyof Charte>(k: K, v: Charte[K]) => setC((p) => ({ ...p, [k]: v }));
  const contenu = { ...c, adjectifs: adj.split(/[,;\n]+/).map((a) => a.trim()).filter(Boolean) };
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="contenu" value={JSON.stringify(contenu)} />
      <p className="text-xs font-semibold uppercase tracking-wide text-text">Volet 1 · Identité visuelle</p>
      <S n="01" t="Couleurs" aide="Une ligne par couleur : pastille ou code, nom parlant, usage.">
        <div className="grid gap-2">
          {c.couleurs.map((k, i) => <LigneCouleur key={i} c={k} onChange={(v) => maj("couleurs", c.couleurs.map((x, j) => (j === i ? v : x)))} onRemove={() => maj("couleurs", c.couleurs.filter((_, j) => j !== i))} />)}
          {c.couleurs.length < 8 && <button type="button" onClick={() => maj("couleurs", [...c.couleurs, { nom: "", hex: "#586b50", usage: "" }])} className="inline-flex h-8 w-fit items-center gap-1 rounded-full border border-border px-3 text-xs text-title hover:border-text"><PlusIcon size={13} /> Ajouter une couleur</button>}
        </div>
      </S>
      <S n="02" t="Typographies">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Titres et accroches"><Input value={c.policeTitres} onChange={(e) => maj("policeTitres", e.target.value)} maxLength={120} placeholder="ex. Playfair Display" /></Field>
          <Field label="Textes et informations"><Input value={c.policeTextes} onChange={(e) => maj("policeTextes", e.target.value)} maxLength={120} placeholder="ex. Montserrat" /></Field>
        </div>
        <Textarea value={c.policesNote} onChange={(e) => maj("policesNote", e.target.value)} maxLength={600} placeholder="Graisses, tailles, où la télécharger (Google Fonts…)." className="mt-2 min-h-14 text-sm" />
      </S>
      <S t="Univers photographique" aide="Une phrase d’intention, puis les types d’images utilisés.">
        <Textarea value={c.photoTexte} onChange={(e) => maj("photoTexte", e.target.value)} maxLength={600} placeholder="ex. Des images lumineuses et naturelles, qui mettent en valeur le geste artisanal." className="mb-2 min-h-14 text-sm" />
        <ListePuces items={c.photoPuces} onChange={(v) => maj("photoPuces", v)} placeholderTitre="ex. Compositions florales" placeholderTexte="ex. textures douces et couleurs naturelles" ajout="Ajouter un type d’image" />
      </S>
      <S t="Style (facultatif)">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="mb-1.5 text-xs font-medium text-text-strong">Espacements</p><Choix options={DENSITES} value={c.densite} onChange={(v) => maj("densite", v)} /></div>
          <div><p className="mb-1.5 text-xs font-medium text-text-strong">Formes</p><Choix options={FORMES} value={c.formes} onChange={(v) => maj("formes", v)} /></div>
          <div><p className="mb-1.5 text-xs font-medium text-text-strong">Clair / sombre</p><Choix options={MODES} value={c.mode} onChange={(v) => maj("mode", v)} /></div>
        </div>
      </S>

      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-text">Volet 2 · Esprit de marque et conseils</p>
      <S n="03" t="L’esprit de la marque">
        <Textarea value={c.espritTexte} onChange={(e) => maj("espritTexte", e.target.value)} maxLength={800} placeholder="ex. Une marque chaleureuse, artisanale et élégante, qui transmet des émotions à travers ses créations." className="min-h-16 text-sm" />
        <Field label="Adjectifs (séparés par des virgules)"><Input value={adj} onChange={(e) => setAdj(e.target.value)} placeholder="Authentique, Chaleureuse, Élégante, Créative, Naturelle" /></Field>
        <Field label="Ce que les clients doivent ressentir"><Input value={c.ressenti} onChange={(e) => maj("ressenti", e.target.value)} maxLength={400} placeholder="de la proximité, de la confiance et le plaisir d’offrir" /></Field>
      </S>
      <S n="04" t="Façon de communiquer">
        <Textarea value={c.ton} onChange={(e) => maj("ton", e.target.value)} maxLength={600} placeholder="ex. Un ton chaleureux, délicat, accessible et professionnel. Privilégiez l’émotion plutôt qu’un discours trop commercial." className="min-h-16 text-sm" />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Exemple à privilégier"><Input value={c.privilegier} onChange={(e) => maj("privilegier", e.target.value)} maxLength={400} placeholder="Une jolie attention pour faire plaisir, à retrouver dans nos boutiques." /></Field>
          <Field label="Exemple à éviter"><Input value={c.eviter} onChange={(e) => maj("eviter", e.target.value)} maxLength={400} placeholder="MEGA PROMO !!! DES FLEURS À PRIX CASSÉS !!!" /></Field>
        </div>
      </S>
      <S n="05" t="Conseils ACCO" aide="Des conseils concrets, numérotés, que le client pourra appliquer.">
        <ListePuces items={c.conseils} onChange={(v) => maj("conseils", v)} placeholderTitre="ex. Valorisez votre savoir-faire" placeholderTexte="ex. Montrez les coulisses de vos créations avec des photos authentiques." ajout="Ajouter un conseil" />
      </S>
      <S t="Bon à savoir (facultatif)">
        <Textarea value={c.note} onChange={(e) => maj("note", e.target.value)} maxLength={3000} placeholder="Règles d’usage du logo (marges, fond clair / foncé), icônes utilisées…" className="min-h-16 text-sm" />
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
