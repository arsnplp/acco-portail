import { PaletteIcon } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { Empty } from "@/components/ui/empty";
import { lireCharte } from "@/lib/charte";
import { signedUrl } from "@/lib/storage";
import { RecapCharte } from "@/components/charte/recap";

export const metadata = { title: "Votre DA" };

/** « Votre DA » : la charte graphique du site, rédigée par l'équipe à la livraison. Lecture seule, fichiers téléchargeables. */
export default async function DaClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const charte = await prisma.charte.findUnique({ where: { siteId: site.id }, include: { pieces: { orderBy: { createdAt: "asc" } } } });
  if (!charte?.publieeAt) return <Empty icon={PaletteIcon} title="Votre DA arrive" text="À la livraison de votre site, vous retrouverez ici sa charte graphique : couleurs, polices, logo à télécharger et conseils pour rester cohérent partout." />;
  const pieces = await Promise.all(charte.pieces.map(async (p) => ({ ...p, url: await signedUrl("site-assets", p.storagePath, 3600), image: /^image\//.test(p.contentType ?? "") })));
  return (
    <div>
      <p className="mb-3 text-sm text-text">La charte graphique de <span className="font-semibold text-title">{site.name}</span> : ce qui fait son identité. Réutilisez-la sur vos réseaux, vos cartes et vos supports pour rester cohérent.</p>
      <RecapCharte c={lireCharte(charte.contenu)} pieces={pieces} />
    </div>
  );
}
