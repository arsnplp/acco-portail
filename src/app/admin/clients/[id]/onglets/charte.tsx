/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { PaletteIcon, PaperclipIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { DENSITES, FORMES, IMAGES, LOGO_ETATS, MODES, PIECE_KINDS, avancementCharte, lab, lireCharte } from "@/lib/charte";
import { signedUrl } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { fmtDayTime } from "@/lib/crm";
import type { Ctx } from "./ctx";

const Ligne = ({ l, v }: { l: string; v: React.ReactNode }) => <li className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 px-4 py-2"><span className="text-text">{l}</span><span className="text-right font-medium text-title">{v || "—"}</span></li>;
const Pastille = ({ hex }: { hex: string }) => (hex ? <span className="inline-flex items-center gap-1.5"><span className="inline-block size-4 rounded-full border border-border" style={{ background: hex }} /><span className="font-mono text-xs">{hex}</span></span> : null);

/** Onglet Charte : ce que le client a rempli dans « Votre DA » (lecture seule côté équipe), aperçu, fichiers déposés. */
export async function CharteOnglet({ clientId }: Ctx) {
  const [client, charte] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { logoPath: true } }),
    prisma.charte.findUnique({ where: { clientId }, include: { pieces: { orderBy: { createdAt: "asc" } } } }),
  ]);
  const c = lireCharte(charte?.contenu);
  const pieces = await Promise.all((charte?.pieces ?? []).map(async (p) => ({ ...p, url: await signedUrl("site-assets", p.storagePath, 3600), image: /^image\//.test(p.contentType ?? "") })));
  const aLogo = !!client.logoPath || pieces.some((p) => p.kind === "logo");
  const av = avancementCharte(c, aLogo);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <SectionTitle icon={PaletteIcon}>Charte graphique (« Votre DA » côté client)</SectionTitle>
        <Card className="mb-3">
          <p className="text-sm text-text">{charte ? `${av.faites} partie${av.faites > 1 ? "s" : ""} sur ${av.total} renseignée${av.faites > 1 ? "s" : ""} · dernière modification ${fmtDayTime(charte.updatedAt)}` : "Le client n’a pas encore ouvert sa page « Votre DA »."}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-green" style={{ width: `${av.pourcent}%` }} /></div>
          <p className="mt-2 text-xs text-muted">Le client remplit depuis son portail (Mon compte → Votre DA). L’équipe lit ici ; pour une correction, passez par lui ou par Messages.</p>
        </Card>
        <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
          <Ligne l="Ambiance" v={<span className="whitespace-pre-line font-normal">{c.mots}</span>} />
          <Ligne l="Couleur principale" v={<Pastille hex={c.couleurs.principale} />} />
          <Ligne l="Couleur secondaire" v={<Pastille hex={c.couleurs.secondaire} />} />
          <Ligne l="Couleur d’accent" v={<Pastille hex={c.couleurs.accent} />} />
          {c.couleursNote && <Ligne l="Note couleurs" v={<span className="whitespace-pre-line font-normal">{c.couleursNote}</span>} />}
          <Ligne l="Polices" v={<span className="whitespace-pre-line font-normal">{c.policesNote}</span>} />
          <Ligne l="Espacements" v={lab(DENSITES, c.densite)} />
          <Ligne l="Formes" v={lab(FORMES, c.formes)} />
          <Ligne l="Clair / sombre" v={lab(MODES, c.mode)} />
          <Ligne l="Images" v={lab(IMAGES, c.images)} />
          <Ligne l="Logo" v={lab(LOGO_ETATS, c.logoEtat) || (aLogo ? "Reçu" : "")} />
          {c.inspirations && <Ligne l="Inspirations" v={<span className="block max-w-full whitespace-pre-line break-all text-left font-normal">{c.inspirations.split(/\n+/).map((u, i) => /^https?:\/\//.test(u.trim()) ? <Link key={i} href={u.trim()} target="_blank" className="block underline">{u.trim()}</Link> : <span key={i} className="block">{u}</span>)}</span>} />}
          {c.eviter && <Ligne l="À éviter" v={<span className="whitespace-pre-line font-normal text-pink">{c.eviter}</span>} />}
        </ul>
      </div>
      <div>
        <SectionTitle icon={PaperclipIcon}>Fichiers déposés ({pieces.length})</SectionTitle>
        {pieces.length === 0 ? <p className="text-sm text-text">Aucun fichier pour l’instant.</p> : (
          <ul className="grid gap-2">
            {pieces.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-2">
                {p.image && p.url ? <img src={p.url} alt="" className="size-12 shrink-0 rounded-lg border border-border bg-white object-contain" /> : <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] font-semibold uppercase text-text">{p.fileName.split(".").pop()?.slice(0, 4)}</span>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-title">{p.fileName}</p><p className="text-[11px] text-text">{PIECE_KINDS[p.kind] ?? p.kind} · {fmtDate(p.createdAt)} · {Math.round(p.sizeBytes / 1024)} Ko</p></div>
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-title underline-offset-2 hover:underline">Télécharger</a>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
