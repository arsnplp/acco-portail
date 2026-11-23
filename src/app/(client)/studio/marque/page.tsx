import Link from "next/link";
import { PaletteIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Mon univers de marque" };

/** Studio / Identité : renvoie vers la DA de chaque site (rédigée par l'équipe à la livraison). */
export default async function MarquePage() {
  const { client } = await requireClientContext();
  const sites = await prisma.site.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, charte: { select: { publieeAt: true } } } });
  const publiees = sites.filter((s) => s.charte?.publieeAt);
  return (
    <Page title="Mon univers de marque." subtitle="Les repères essentiels de votre identité et de votre communication.">
      <div className="-mt-4 mb-4"><BackLink fallback="/studio" label="Studio" /></div>
      {publiees.length === 0 ? (
        <Empty icon={PaletteIcon} title="Votre DA arrive" text="À la livraison de votre site, votre charte graphique (logo, couleurs, typographies, esprit de marque) sera rédigée par votre équipe ACCO et disponible ici." />
      ) : (
        <div className="grid gap-3">
          {publiees.map((s) => (
            <Card key={s.id} href={`/studio/marque/${s.id}`} className="flex items-center justify-between gap-3 py-3">
              <div><p className="font-semibold text-title">{s.name}</p><p className="text-xs text-text">Logo, couleurs, typographies, esprit de marque et conseils</p></div>
              <Badge tone="green">✓ Validée</Badge>
            </Card>
          ))}
          {sites.length > publiees.length && <p className="text-xs text-text">{sites.length - publiees.length} site{sites.length - publiees.length > 1 ? "s" : ""} en attente de livraison.</p>}
        </div>
      )}
      <p className="mt-6 text-sm text-text">Une évolution de votre identité en tête ? <Link href="/offres" className="underline">Voir nos services</Link>.</p>
    </Page>
  );
}
