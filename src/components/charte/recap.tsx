/* eslint-disable @next/next/no-img-element */
import { DownloadIcon } from "lucide-react";
import { COULEURS, DENSITES, FORMES, IMAGES, MODES, PIECE_KINDS, lab, type Charte } from "@/lib/charte";
import { fmtDate } from "@/lib/format";

export type PieceAffichee = { id: string; kind: string; fileName: string; contentType: string | null; sizeBytes: number; createdAt: Date; url: string | null; image: boolean; action?: React.ReactNode };

const Bloc = ({ t, children }: { t: string; children: React.ReactNode }) => <section className="rounded-card border border-border bg-surface p-4"><h2 className="mb-2 text-sm font-semibold text-title">{t}</h2>{children}</section>;

/** Récapitulatif de la charte, en lecture : utilisé côté client (« Votre DA ») et en aperçu côté équipe. */
export function RecapCharte({ c, pieces }: { c: Charte; pieces: PieceAffichee[] }) {
  const couleurs = COULEURS.filter((k) => c.couleurs[k.key]);
  const logos = pieces.filter((p) => p.kind === "logo"), autres = pieces.filter((p) => p.kind !== "logo");
  return (
    <div className="grid gap-3">
      {c.ambiance && <Bloc t="Ambiance"><p className="whitespace-pre-line text-sm text-text-strong">{c.ambiance}</p></Bloc>}
      {logos.length > 0 && (
        <Bloc t="Votre logo">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {logos.map((p) => (
              <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="group rounded-card border border-border p-2 transition-colors hover:border-text">
                <div className="flex h-24 items-center justify-center rounded-lg bg-[repeating-conic-gradient(#8883_0_25%,transparent_0_50%)] bg-[length:16px_16px]">{p.image && p.url ? <img src={p.url} alt="" className="max-h-20 max-w-full object-contain" /> : <span className="text-xs font-semibold uppercase text-text">{p.fileName.split(".").pop()}</span>}</div>
                <p className="mt-1.5 flex items-center justify-between gap-1 text-[11px] text-text"><span className="truncate">{p.fileName}</span><DownloadIcon size={12} className="shrink-0" /></p>
              </a>
            ))}
          </div>
        </Bloc>
      )}
      {couleurs.length > 0 && (
        <Bloc t="Couleurs">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {couleurs.map((k) => (
              <div key={k.key} className="rounded-card border border-border p-2">
                <div className="h-14 rounded-lg border border-border" style={{ background: c.couleurs[k.key] }} />
                <p className="mt-1.5 text-sm font-semibold text-title">{k.label}</p>
                <p className="font-mono text-xs text-text-strong">{c.couleurs[k.key].toUpperCase()}</p>
                <p className="text-[11px] text-text">{k.aide}</p>
              </div>
            ))}
          </div>
          {c.couleursNote && <p className="mt-2 whitespace-pre-line text-sm text-text-strong">{c.couleursNote}</p>}
        </Bloc>
      )}
      {(c.policeTitres || c.policeTextes) && (
        <Bloc t="Polices">
          <div className="grid gap-2 sm:grid-cols-2">
            {c.policeTitres && <div className="rounded-card border border-border p-3"><p className="text-[11px] text-text">Titres</p><p className="text-lg font-bold text-title">{c.policeTitres}</p></div>}
            {c.policeTextes && <div className="rounded-card border border-border p-3"><p className="text-[11px] text-text">Textes</p><p className="text-lg text-title">{c.policeTextes}</p></div>}
          </div>
          {c.policesNote && <p className="mt-2 whitespace-pre-line text-sm text-text-strong">{c.policesNote}</p>}
        </Bloc>
      )}
      {(c.densite || c.formes || c.mode || c.images) && (
        <Bloc t="Style">
          <ul className="divide-y divide-border text-sm">
            {c.densite && <li className="flex justify-between py-1.5"><span className="text-text">Espacements</span><span className="font-medium text-title">{lab(DENSITES, c.densite)}</span></li>}
            {c.formes && <li className="flex justify-between py-1.5"><span className="text-text">Formes</span><span className="font-medium text-title">{lab(FORMES, c.formes)}</span></li>}
            {c.mode && <li className="flex justify-between py-1.5"><span className="text-text">Clair / sombre</span><span className="font-medium text-title">{lab(MODES, c.mode)}</span></li>}
            {c.images && <li className="flex justify-between py-1.5"><span className="text-text">Images</span><span className="font-medium text-title">{lab(IMAGES, c.images)}</span></li>}
          </ul>
        </Bloc>
      )}
      {c.note && <Bloc t="Bon à savoir"><p className="whitespace-pre-line text-sm text-text-strong">{c.note}</p></Bloc>}
      {autres.length > 0 && (
        <Bloc t="Fichiers">
          <ul className="grid gap-2">{autres.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-card border border-border p-2"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] font-semibold uppercase text-text">{p.fileName.split(".").pop()?.slice(0, 4)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-title">{p.fileName}</p><p className="text-[11px] text-text">{PIECE_KINDS[p.kind] ?? p.kind} · {fmtDate(p.createdAt)} · {Math.round(p.sizeBytes / 1024)} Ko</p></div>{p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-title underline-offset-2 hover:underline">Télécharger</a>}{p.action}</li>)}</ul>
        </Bloc>
      )}
    </div>
  );
}
