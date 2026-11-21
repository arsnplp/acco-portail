"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { AMBIANCES, DENSITES, FORMES, IMAGES, LOGO_ETATS, MAX_AMBIANCES, MODES, POLICES, hexOk, type Charte } from "@/lib/charte";
import { ApercuCharte } from "@/components/charte/apercu";
import { Textarea, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveCharte, supprimerPieceCharte, uploadPieceCharte, type CharteState } from "./actions";

/* ───────── petits blocs réutilisés ───────── */

function Bloc({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-title">{titre}</h2>
      {aide && <p className="mt-0.5 mb-3 text-xs text-text">{aide}</p>}
      {!aide && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** Cartes à choix unique (gros boutons lisibles, une seule réponse). */
function Choix({ options, value, onChange, cols = 3, rendu }: { options: { key: string; label: string; aide: string }[]; value: string; onChange: (v: string) => void; cols?: 2 | 3; rendu?: (key: string) => React.ReactNode }) {
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button key={o.key} type="button" onClick={() => onChange(on ? "" : o.key)} aria-pressed={on} className={cn("min-w-0 rounded-card border px-2 py-2.5 text-left transition-colors", on ? "border-title bg-surface-2" : "border-border hover:border-text")}>
            {rendu?.(o.key)}
            <span className="block truncate text-sm font-semibold text-title">{o.label}</span>
            <span className="block text-[11px] leading-snug text-text">{o.aide}</span>
          </button>
        );
      })}
    </div>
  );
}

function Couleur({ label, value, onChange, aide }: { label: string; value: string; onChange: (v: string) => void; aide: string }) {
  const [txt, setTxt] = useState(value);
  const applique = (v: string) => { setTxt(v); if (hexOk(v)) onChange(v.toLowerCase()); if (v === "") onChange(""); };
  return (
    <div className="flex items-center gap-3 rounded-card border border-border p-2">
      <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border" style={{ background: value || "transparent" }} title="Choisir la couleur">
        <input type="color" value={value || "#888888"} onChange={(e) => applique(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`Couleur ${label}`} />
        {!value && <span className="absolute inset-0 flex items-center justify-center text-lg text-muted">+</span>}
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-title">{label}</p>
        <p className="truncate text-[11px] text-text">{aide}</p>
      </div>
      <input value={txt} onChange={(e) => applique(e.target.value.trim())} placeholder="#000000" maxLength={7} className="w-[88px] rounded-lg border border-border bg-surface px-2 py-1.5 text-center font-mono text-xs text-title outline-none focus:border-blue" aria-label={`Code ${label}`} />
    </div>
  );
}

/* ───────── formulaire principal ───────── */

export function CharteForm({ init, nom, logoUrl, aLogo }: { init: Charte; nom: string; logoUrl: string | null; aLogo: boolean }) {
  const [c, setC] = useState<Charte>(init);
  const [state, action] = useActionState<CharteState, FormData>(saveCharte, {});
  const maj = <K extends keyof Charte>(k: K, v: Charte[K]) => setC((p) => ({ ...p, [k]: v }));
  const toggleAmbiance = (k: string) => setC((p) => ({ ...p, ambiance: p.ambiance.includes(k) ? p.ambiance.filter((x) => x !== k) : p.ambiance.length >= MAX_AMBIANCES ? p.ambiance : [...p.ambiance, k] }));
  const pastille = (couleur: string) => <span className="mb-1 block h-2 w-8 rounded-full" style={{ background: couleur }} />;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="contenu" value={JSON.stringify(c)} />

      {/* Aperçu en direct, collé en haut : le client voit tout de suite l'effet de ses choix. */}
      <div className="sticky top-14 z-10 -mx-4 bg-bg/95 px-4 pb-1.5 pt-1 backdrop-blur">
        <ApercuCharte charte={c} nom={nom} logoUrl={logoUrl} compact />
        <p className="mt-1 text-center text-[11px] text-muted">Aperçu indicatif : il bouge avec vos choix.</p>
      </div>

      <Bloc titre="1. L’ambiance" aide={`Choisissez jusqu’à ${MAX_AMBIANCES} mots qui vous ressemblent.`}>
        <div className="flex flex-wrap gap-2">
          {AMBIANCES.map((a) => {
            const on = c.ambiance.includes(a.key);
            const plein = !on && c.ambiance.length >= MAX_AMBIANCES;
            return (
              <button key={a.key} type="button" onClick={() => toggleAmbiance(a.key)} disabled={plein} aria-pressed={on} title={a.aide} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors", on ? "border-title bg-title text-bg" : "border-border text-title hover:border-text", plein && "opacity-40")}>
                {on && <CheckIcon size={14} />} {a.label}
              </button>
            );
          })}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-text-strong">En trois mots, votre entreprise c’est…</span>
          <input value={c.mots} onChange={(e) => maj("mots", e.target.value)} maxLength={120} placeholder="ex. artisanal, de confiance, chaleureux" className="w-full rounded-card border border-border bg-surface px-3 py-2.5 text-sm text-title placeholder:text-muted outline-none focus:border-blue" />
        </label>
      </Bloc>

      <Bloc titre="2. Les couleurs" aide="Touchez la pastille pour choisir, ou collez un code si vous l’avez. Rien d’obligatoire.">
        <div className="grid gap-2">
          <Couleur label="Principale" aide="boutons, titres, ce qu’on voit en premier" value={c.couleurs.principale} onChange={(v) => maj("couleurs", { ...c.couleurs, principale: v })} />
          <Couleur label="Secondaire" aide="fonds, encadrés" value={c.couleurs.secondaire} onChange={(v) => maj("couleurs", { ...c.couleurs, secondaire: v })} />
          <Couleur label="Accent" aide="petites touches, icônes" value={c.couleurs.accent} onChange={(v) => maj("couleurs", { ...c.couleurs, accent: v })} />
        </div>
        <Textarea value={c.couleursNote} onChange={(e) => maj("couleursNote", e.target.value)} maxLength={500} placeholder="Couleurs déjà sur votre enseigne ou vos cartes, couleurs à éviter…" className="mt-2 min-h-16 text-sm" />
      </Bloc>

      <Bloc titre="3. Les polices" aide="Le style d’écriture. Regardez l’aperçu pour sentir la différence.">
        <p className="mb-1.5 text-xs font-medium text-text-strong">Pour les titres</p>
        <Choix options={POLICES} value={c.policeTitres} onChange={(v) => maj("policeTitres", v)} rendu={(k) => <span className="block truncate text-xl leading-tight text-title" style={{ fontFamily: POLICES.find((p) => p.key === k)?.famille }}>Aa</span>} />
        <p className="mb-1.5 mt-3 text-xs font-medium text-text-strong">Pour les textes</p>
        <Choix options={POLICES} value={c.policeTextes} onChange={(v) => maj("policeTextes", v)} rendu={(k) => <span className="block truncate text-xl leading-tight text-title" style={{ fontFamily: POLICES.find((p) => p.key === k)?.famille }}>Aa</span>} />
        <Textarea value={c.policesNote} onChange={(e) => maj("policesNote", e.target.value)} maxLength={300} placeholder="Si vous utilisez déjà une police (enseigne, cartes de visite), son nom ici. Vous pouvez aussi déposer le fichier plus bas." className="mt-2 min-h-16 text-sm" />
      </Bloc>

      <Bloc titre="4. Les espacements" aide="Plutôt aéré ou plutôt rempli ?">
        <Choix options={DENSITES} value={c.densite} onChange={(v) => maj("densite", v)} />
      </Bloc>

      <Bloc titre="5. Les formes" aide="Boutons et encadrés.">
        <Choix cols={2} options={FORMES} value={c.formes} onChange={(v) => maj("formes", v)} rendu={(k) => <span className="mb-1 block h-5 w-10 border-2 border-title" style={{ borderRadius: k === "arrondi" ? 10 : 2 }} />} />
      </Bloc>

      <Bloc titre="6. Clair ou sombre" aide="L’ambiance générale de l’écran.">
        <Choix options={MODES} value={c.mode} onChange={(v) => maj("mode", v)} rendu={(k) => pastille(k === "sombre" ? "#15171c" : k === "clair" ? "#ffffff" : "linear-gradient(90deg,#fff 50%,#15171c 50%)")} />
      </Bloc>

      <Bloc titre="7. Les images" aide="Ce qui illustrera vos pages.">
        <Choix options={IMAGES} value={c.images} onChange={(v) => maj("images", v)} />
      </Bloc>

      <Bloc titre="8. Votre logo" aide={aLogo ? "Votre logo est bien reçu. Déposez d’autres versions plus bas si vous en avez (fond clair, fond foncé, icône seule)." : "Dites-nous où vous en êtes, puis déposez le fichier plus bas."}>
        <Choix options={LOGO_ETATS} value={c.logoEtat} onChange={(v) => maj("logoEtat", v)} />
      </Bloc>

      <Bloc titre="9. Vos inspirations" aide="Des sites que vous aimez (même d’un autre métier), un lien par ligne. Vous pouvez aussi déposer des captures d’écran plus bas.">
        <Textarea value={c.inspirations} onChange={(e) => maj("inspirations", e.target.value)} maxLength={1500} placeholder={"https://…\nhttps://…"} className="min-h-20 text-sm" />
        <p className="mb-1.5 mt-3 text-xs font-medium text-text-strong">Ce qu’il ne faut surtout pas faire</p>
        <Textarea value={c.eviter} onChange={(e) => maj("eviter", e.target.value)} maxLength={1000} placeholder="ex. pas de rouge, pas de photos de banque d’images, pas de texte en majuscules…" className="min-h-16 text-sm" />
      </Bloc>

      <div className="pt-1">
        <SubmitButton className="w-full" pendingLabel="Enregistrement…">Enregistrer ma charte</SubmitButton>
        <FormError message={state.error} />
        {state.ok && <p className="mt-1 text-center text-xs text-green">{state.ok}</p>}
      </div>
    </form>
  );
}

/* ───────── fichiers ───────── */

export function DepotPiece({ kind, label, accept, aide }: { kind: string; label: string; accept: string; aide: string }) {
  const [state, action, pending] = useActionState<CharteState, FormData>(uploadPieceCharte.bind(null, kind), {});
  return (
    <form action={action}>
      <label className={cn("flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-border p-3 hover:border-text", pending && "opacity-60")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-title"><UploadIcon size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-title">{pending ? "Envoi…" : label}</span>
          <span className="block text-[11px] text-text">{aide}</span>
        </span>
        <input type="file" name="file" accept={accept} className="sr-only" disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      </label>
      <FormError message={state.error} />
      {state.ok && <p className="mt-1 text-xs text-green">{state.ok}</p>}
    </form>
  );
}

export function SupprimerPiece({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Retirer ce fichier ?") && start(() => supprimerPieceCharte(id))} aria-label="Retirer" className="flex size-8 items-center justify-center rounded-full text-text hover:text-pink disabled:opacity-50"><Trash2Icon size={14} /></button>;
}
