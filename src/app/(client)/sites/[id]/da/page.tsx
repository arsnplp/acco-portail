import { PaletteIcon } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { Empty } from "@/components/ui/empty";
import { lireCharte } from "@/lib/charte";
import { signedUrl } from "@/lib/storage";
import { RecapCharte, VoletsCharte, type VoletCharte } from "@/components/charte/recap";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Votre DA" };

/** « Votre DA » : la charte graphique du site, rédigée par l'équipe à la livraison. Lecture seule, fichiers téléchargeables. */
export default async function DaClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const volet: VoletCharte = (await searchParams).v === "esprit" ? "esprit" : "identite";
  const { site } = await requireClientSite(id);
  const charte = await prisma.charte.findUnique({ where: { siteId: site.id }, include: { pieces: { orderBy: { createdAt: "asc" } } } });
  if (!charte?.publieeAt) return <Empty icon={PaletteIcon} title="Votre DA arrive" text="À la livraison de votre site, vous retrouverez ici sa charte graphique : couleurs, polices, logo à télécharger et conseils pour rester cohérent partout." />;
  const pieces = await Promise.all(charte.pieces.map(async (p) => ({ ...p, url: await signedUrl("site-assets", p.storagePath, 3600), image: /^image\//.test(p.contentType ?? "") })));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-text">Votre identité, votre façon de communiquer et les conseils de votre équipe ACCO.</p>
        <Badge tone="green">✓ Identité validée par ACCO</Badge>
      </div>
      <VoletsCharte base={`/sites/${site.id}/da`} volet={volet} />
      <RecapCharte c={lireCharte(charte.contenu)} pieces={pieces} volet={volet} />
    </div>
  );
}
