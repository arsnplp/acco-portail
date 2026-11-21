/* eslint-disable @next/next/no-img-element */
import { PaletteIcon, PaperclipIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { Page } from "@/components/page";
import { signedUrl } from "@/lib/storage";
import { logoSrc } from "@/lib/logo-utils";
import { avancementCharte, chargerCharte, lireCharte, PIECE_KINDS } from "@/lib/charte";
import { fmtDate } from "@/lib/format";
import { CharteForm, DepotPiece, SupprimerPiece } from "./form";

export const metadata = { title: "Votre DA" };

/** « Votre DA » : la charte graphique du client, remplie par lui, lue par l'équipe sur sa fiche. Indépendante des sites. */
export default async function ChartePage() {
  const { client } = await requireClientContext();
  const charte = await chargerCharte(client.id);
  const c = lireCharte(charte.contenu);
  const aLogo = !!client.logoPath || charte.pieces.some((p) => p.kind === "logo");
  const av = avancementCharte(c, aLogo);
  const pieces = await Promise.all(charte.pieces.map(async (p) => ({ ...p, url: await signedUrl("site-assets", p.storagePath, 3600), image: /^image\//.test(p.contentType ?? "") })));
  const logoUrl = client.logoPath ? logoSrc(client.id, client.logoPath, false) : pieces.find((p) => p.kind === "logo" && p.image)?.url ?? null;

  return (
    <Page title="Votre DA" subtitle="Votre charte graphique : ce qui fait que votre site vous ressemble.">
      <div className="-mt-3 mb-4 rounded-card border border-border bg-surface p-3">
        <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-semibold text-title"><PaletteIcon size={16} className="text-text" /> {av.faites === av.total ? "Charte complète, merci !" : `${av.faites} partie${av.faites > 1 ? "s" : ""} sur ${av.total} renseignée${av.faites > 1 ? "s" : ""}`}</span><span className="tabular-nums text-text">{av.pourcent} %</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-green transition-all" style={{ width: `${av.pourcent}%` }} /></div>
        <p className="mt-2 text-xs text-text">Rien n’est obligatoire : répondez à ce que vous savez, on s’occupe du reste. Vous pouvez revenir quand vous voulez.</p>
      </div>

      <CharteForm init={c} nom={client.name} logoUrl={logoUrl} aLogo={aLogo} />

      <section className="mt-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-title"><PaperclipIcon size={16} className="text-text" /> Vos fichiers</h2>
        <p className="mb-3 text-xs text-text">Logo, polices, captures de sites que vous aimez, ancienne charte… Tout ce qui peut nous aider.</p>
        <div className="grid gap-2">
          <DepotPiece kind="logo" label="Déposer mon logo" accept="image/*,.pdf,.ai,.eps,.svg" aide="PNG, SVG, PDF ou fichier source. Plusieurs versions bienvenues." />
          <DepotPiece kind="police" label="Déposer une police" accept=".ttf,.otf,.woff,.woff2,font/*" aide="Si vous avez le fichier de votre police." />
          <DepotPiece kind="inspiration" label="Déposer une inspiration" accept="image/*,.pdf" aide="Capture d’écran, photo, flyer, ancienne charte…" />
        </div>
        {pieces.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {pieces.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-2">
                {p.image && p.url ? <img src={p.url} alt="" className="size-12 shrink-0 rounded-lg border border-border bg-white object-contain" /> : <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] font-semibold uppercase text-text">{p.fileName.split(".").pop()?.slice(0, 4)}</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-title">{p.fileName}</p>
                  <p className="text-[11px] text-text">{PIECE_KINDS[p.kind] ?? p.kind} · {fmtDate(p.createdAt)}</p>
                </div>
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-text underline-offset-2 hover:underline">Voir</a>}
                <SupprimerPiece id={p.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
