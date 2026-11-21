/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CheckIcon, DownloadIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { DENSITES, FORMES, MODES, PIECE_KINDS, lab, type Charte } from "@/lib/charte";
import { fmtDate } from "@/lib/format";

export type PieceAffichee = { id: string; kind: string; fileName: string; contentType: string | null; sizeBytes: number; createdAt: Date; url: string | null; image: boolean; action?: React.ReactNode };
export type VoletCharte = "identite" | "esprit";

const Bloc = ({ n, t, children }: { n?: string; t: string; children: React.ReactNode }) => (
  <section className="rounded-card border border-border bg-surface p-4">
    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-title">{n && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-text">{n}</span>}{t}</h2>
    {children}
  </section>
);

/** Onglets du récap : « Mon identité visuelle » / « Mon esprit de marque & conseils ». `base` = URL de la page, le volet passe en ?v=. */
export function VoletsCharte({ base, volet }: { base: string; volet: VoletCharte }) {
  const items: [VoletCharte, string][] = [["identite", "Mon identité visuelle"], ["esprit", "Mon esprit de marque & conseils"]];
  return (
    <div className="mb-4 border-b border-border">
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(([k, l]) => <li key={k} className="shrink-0"><Link href={k === "identite" ? base : `${base}?v=${k}`} className={cn("-mb-px block border-b-2 px-3 py-2.5 text-sm font-medium", volet === k ? "border-title text-title" : "border-transparent text-text hover:text-title")}>{l}</Link></li>)}
      </ul>
    </div>
  );
}

/** Récapitulatif de la charte, en lecture : côté client (« Votre DA ») et en aperçu côté équipe. */
export function RecapCharte({ c, pieces, volet = "identite" }: { c: Charte; pieces: PieceAffichee[]; volet?: VoletCharte }) {
  const logos = pieces.filter((p) => p.kind === "logo"), autres = pieces.filter((p) => p.kind !== "logo");
  const logoPrincipal = logos.find((p) => p.image && p.url) ?? null;
  const style = [c.densite && ["Espacements", lab(DENSITES, c.densite)], c.formes && ["Formes", lab(FORMES, c.formes)], c.mode && ["Clair / sombre", lab(MODES, c.mode)]].filter(Boolean) as [string, string][];

  if (volet === "esprit") {
    return (
      <div className="grid gap-3">
        {(c.espritTexte || c.adjectifs.length > 0 || c.ressenti) && (
          <Bloc n="03" t="L’esprit de ma marque">
            {c.espritTexte && <p className="text-base leading-relaxed text-title">{c.espritTexte}</p>}
            {c.adjectifs.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{c.adjectifs.map((a) => <span key={a} className="rounded-full border border-green/40 bg-green/10 px-3 py-1 text-sm text-green">{a}</span>)}</div>}
            {c.ressenti && <p className="mt-3 text-sm text-text">Ce que vos clients doivent ressentir : {c.ressenti}</p>}
          </Bloc>
        )}
        {(c.ton || c.privilegier || c.eviter) && (
          <Bloc n="04" t="Ma façon de communiquer">
            {c.ton && <p className="text-base leading-relaxed text-title">{c.ton}</p>}
            {c.privilegier && <div className="mt-3 rounded-card border border-green/40 bg-green/10 p-3"><p className="flex items-center gap-1 text-sm font-semibold text-green"><CheckIcon size={14} /> À privilégier</p><p className="mt-1 text-sm text-text-strong">« {c.privilegier} »</p></div>}
            {c.eviter && <div className="mt-2 rounded-card border border-pink/40 bg-pink/10 p-3"><p className="flex items-center gap-1 text-sm font-semibold text-pink"><XIcon size={14} /> À éviter</p><p className="mt-1 text-sm text-text-strong">« {c.eviter} »</p></div>}
          </Bloc>
        )}
        {c.conseils.length > 0 && (
          <Bloc n="05" t="Mes conseils ACCO">
            <ol className="grid gap-2">{c.conseils.map((p, i) => <li key={i} className="flex gap-3 rounded-card border border-border p-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue/15 font-mono text-xs font-semibold text-blue">{String(i + 1).padStart(2, "0")}</span><div><p className="text-sm font-semibold text-title">{p.titre}</p>{p.texte && <p className="mt-0.5 text-sm text-text">{p.texte}</p>}</div></li>)}</ol>
          </Bloc>
        )}
        {c.note && <Bloc t="Bon à savoir"><p className="whitespace-pre-line text-sm text-text-strong">{c.note}</p></Bloc>}
        {!c.espritTexte && !c.ton && c.conseils.length === 0 && !c.note && <p className="text-sm text-text">Cette partie n’est pas encore renseignée.</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {(logoPrincipal || logos.length > 0) && (
        <Bloc t="Mon logo">
          {logoPrincipal && <div className="flex h-44 items-center justify-center rounded-card bg-[#f1ece4] p-6"><img src={logoPrincipal.url!} alt="" className="max-h-full max-w-full object-contain" /></div>}
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text">Vos fichiers de marque</p>
          <p className="mt-1 text-sm text-text">Votre logo officiel, prêt à être utilisé sur vos supports de communication.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {logos.map((p) => <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-card bg-title px-3 text-sm font-semibold text-bg hover:bg-text-strong"><DownloadIcon size={14} /> {logos.length > 1 ? p.fileName : "Télécharger mon logo"}</a>)}
          </div>
          {logos.length === 1 && <p className="mt-1.5 text-[11px] text-text">{logos[0].fileName.split(".").pop()?.toUpperCase()} · {Math.round(logos[0].sizeBytes / 1024)} Ko</p>}
        </Bloc>
      )}
      {c.couleurs.length > 0 && (
        <Bloc n="01" t="Mes couleurs">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {c.couleurs.map((k, i) => (
              <div key={i} className="rounded-card border border-border p-2">
                <div className="h-14 rounded-lg border border-border" style={{ background: k.hex }} />
                <p className="mt-1.5 truncate text-sm font-semibold text-title">{k.nom || "Couleur"}</p>
                <p className="font-mono text-xs text-text-strong">{k.hex.toUpperCase()}</p>
                {k.usage && <p className="text-[11px] text-text">{k.usage}</p>}
              </div>
            ))}
          </div>
        </Bloc>
      )}
      {(c.policeTitres || c.policeTextes) && (
        <Bloc n="02" t="Mes typographies">
          <div className="grid gap-2 sm:grid-cols-2">
            {c.policeTitres && <div className="rounded-card border border-border bg-surface-2 p-3"><p className="text-3xl font-bold text-title">Aa</p><p className="mt-1 text-base font-semibold text-title">{c.policeTitres}</p><p className="text-xs text-text">Titres et accroches</p></div>}
            {c.policeTextes && <div className="rounded-card border border-border bg-surface-2 p-3"><p className="text-3xl text-title">Aa</p><p className="mt-1 text-base font-semibold text-title">{c.policeTextes}</p><p className="text-xs text-text">Textes et informations</p></div>}
          </div>
          {c.policesNote && <p className="mt-2 whitespace-pre-line text-sm text-text-strong">{c.policesNote}</p>}
        </Bloc>
      )}
      {(c.photoTexte || c.photoPuces.length > 0) && (
        <Bloc t="Mon univers photographique">
          {c.photoTexte && <p className="text-sm text-text">{c.photoTexte}</p>}
          {c.photoPuces.length > 0 && <ul className="mt-3 grid gap-2">{c.photoPuces.map((p, i) => <li key={i} className="flex items-start gap-3 rounded-card border border-border p-3"><span className="mt-0.5 size-6 shrink-0 rounded-full" style={{ background: c.couleurs[i % Math.max(1, c.couleurs.length)]?.hex ?? "#c7a19c" }} /><div><p className="text-sm font-semibold text-title">{p.titre}</p>{p.texte && <p className="text-sm text-text">{p.texte}</p>}</div></li>)}</ul>}
        </Bloc>
      )}
      {style.length > 0 && <Bloc t="Style"><ul className="divide-y divide-border text-sm">{style.map(([l, v]) => <li key={l} className="flex justify-between py-1.5"><span className="text-text">{l}</span><span className="font-medium text-title">{v}</span></li>)}</ul></Bloc>}
      {autres.length > 0 && (
        <Bloc t="Autres fichiers">
          <ul className="grid gap-2">{autres.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-card border border-border p-2"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] font-semibold uppercase text-text">{p.fileName.split(".").pop()?.slice(0, 4)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-title">{p.fileName}</p><p className="text-[11px] text-text">{PIECE_KINDS[p.kind] ?? p.kind} · {fmtDate(p.createdAt)} · {Math.round(p.sizeBytes / 1024)} Ko</p></div>{p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-title underline-offset-2 hover:underline">Télécharger</a>}{p.action}</li>)}</ul>
        </Bloc>
      )}
      {!logoPrincipal && c.couleurs.length === 0 && !c.policeTitres && !c.photoTexte && <p className="text-sm text-text">Cette partie n’est pas encore renseignée.</p>}
    </div>
  );
}
