import { PaletteIcon } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { lireCharte } from "@/lib/charte";
import { signedUrl } from "@/lib/storage";
import { RecapCharte, VoletsCharte, type VoletCharte } from "@/components/charte/recap";

export const metadata = { title: "Votre DA" };

/** Studio → Mon univers de marque → un site : la DA rédigée par l'équipe à la livraison, en lecture seule. */
export default async function DaStudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const volet: VoletCharte = (await searchParams).v === "esprit" ? "esprit" : "identite";
  const { site } = await requireClientSite(id);
  const charte = await prisma.charte.findUnique({ where: { siteId: site.id }, include: { pieces: { orderBy: { createdAt: "asc" } } } });
  const pieces = charte?.publieeAt ? await Promise.all(charte.pieces.map(async (p) => ({ ...p, url: await signedUrl("site-assets", p.storagePath, 3600), image: /^image\//.test(p.contentType ?? "") }))) : [];
  return (
    <Page title="Mon univers de marque." subtitle={`${site.name} · votre identité, votre façon de communiquer et les conseils de votre équipe ACCO.`}>
      <div className="-mt-4 mb-4"><BackLink fallback="/studio/marque" label="Mon univers de marque" /></div>
      {!charte?.publieeAt ? <Empty icon={PaletteIcon} title="Votre DA arrive" text="À la livraison de votre site, vous retrouverez ici sa charte graphique : couleurs, polices, logo à télécharger et conseils pour rester cohérent partout." /> : (
        <>
          <div className="mb-3"><Badge tone="green">✓ Identité validée par ACCO</Badge></div>
          <VoletsCharte base={`/studio/marque/${site.id}`} volet={volet} />
          <RecapCharte c={lireCharte(charte.contenu)} pieces={pieces} volet={volet} />
        </>
      )}
    </Page>
  );
}
