import { notFound } from "next/navigation";
import { PaletteIcon, PaperclipIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { requireSiteAcces } from "@/lib/perimetre";
import { estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/card";
import { chargerCharte, charteRenseignee, lireCharte, PIECE_KINDS } from "@/lib/charte";
import { signedUrl } from "@/lib/storage";
import { fmtDayTime } from "@/lib/crm";
import { RecapCharte } from "@/components/charte/recap";
import { CharteSiteForm, DepotPieceCharte, PublierCharteButton, SupprimerPieceCharteButton } from "./form";

export const metadata = { title: "Charte graphique" };

/** Charte (DA) du site : l'équipe note ce qui a été utilisé, dépose logo et polices, puis publie pour le client. */
export default async function CharteSitePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireTeam();
  const { id } = await params;
  await requireSiteAcces(me, id);
  const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true, status: true, client: { select: { name: true } } } });
  if (!site) notFound();
  const charte = await chargerCharte(id);
  const c = lireCharte(charte.contenu);
  const externe = estExterne(me);
  const pieces = await Promise.all(charte.pieces.map(async (p) => ({ ...p, url: await signedUrl("site-assets", p.storagePath, 3600), image: /^image\//.test(p.contentType ?? ""), action: externe ? undefined : <SupprimerPieceCharteButton siteId={id} id={p.id} /> })));
  return (
    <AdminPage title={`Charte graphique · ${site.name}`} back={{ href: `/admin/sites/${id}`, label: site.name }} action={<Badge tone={charte.publieeAt ? "green" : charteRenseignee(c) ? "yellow" : "neutral"}>{charte.publieeAt ? "Publiée" : charteRenseignee(c) ? "À publier" : "À rédiger"}</Badge>}>
      <p className="-mt-3 text-sm text-text">{site.client.name}. À remplir à la livraison : ce qui a réellement été utilisé sur le site. Le client n’a rien à saisir ; une fois publiée, il la retrouve dans l’onglet « Votre DA » de son site, avec le logo et les polices à télécharger.{charte.publieeAt ? ` Publiée le ${fmtDayTime(charte.publieeAt)}.` : ""}</p>
      {!externe && <div className="mt-3"><PublierCharteButton siteId={id} publiee={!!charte.publieeAt} /></div>}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <SectionTitle icon={PaletteIcon}>Rédaction</SectionTitle>
          <CharteSiteForm siteId={id} init={c} />
          <SectionTitle icon={PaperclipIcon}>Fichiers ({pieces.length})</SectionTitle>
          <div className="grid gap-3 rounded-card border border-border bg-surface p-4">
            <DepotPieceCharte siteId={id} kind="logo" label="Logo (toutes les versions : couleur, blanc, noir, icône)" accept="image/*,.pdf,.svg,.ai,.eps,.zip" />
            <DepotPieceCharte siteId={id} kind="police" label="Polices (fichiers)" accept=".ttf,.otf,.woff,.woff2,.zip,font/*" />
            <DepotPieceCharte siteId={id} kind="autre" label="Autre (PDF de charte, icônes…)" accept="*/*" />
          </div>
          {pieces.length > 0 && <ul className="mt-3 grid gap-2">{pieces.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-2"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] font-semibold uppercase text-text">{p.fileName.split(".").pop()?.slice(0, 4)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-title">{p.fileName}</p><p className="text-[11px] text-text">{PIECE_KINDS[p.kind] ?? p.kind} · {Math.round(p.sizeBytes / 1024)} Ko</p></div>{p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-title underline-offset-2 hover:underline">Voir</a>}{p.action}</li>)}</ul>}
        </div>
        <div>
          <SectionTitle>Ce que verra le client</SectionTitle>
          {charteRenseignee(c) || pieces.length > 0 ? <div className="grid gap-6"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text">Mon identité visuelle</p><RecapCharte c={c} pieces={pieces.map((p) => ({ ...p, action: undefined }))} volet="identite" /></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text">Mon esprit de marque & conseils</p><RecapCharte c={c} pieces={[]} volet="esprit" /></div></div> : <p className="text-sm text-text">Rien de renseigné pour l’instant.</p>}
        </div>
      </div>
    </AdminPage>
  );
}
