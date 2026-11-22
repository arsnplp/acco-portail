import Link from "next/link";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Art, type ArtKind } from "./art";

export const metadata = { title: "Studio" };

const ENTREES: { kind: ArtKind; titre: string; texte: string; href: string }[] = [
  { kind: "brand", titre: "Mon univers de marque", texte: "Votre identité visuelle, votre logo et votre ton.", href: "/studio/marque" },
  { kind: "create", titre: "Créer", texte: "Flyers, affiches et publications à votre image.", href: "/studio/creer" },
  { kind: "library", titre: "Ma bibliothèque", texte: "Photos, ressources et créations enregistrées.", href: "/studio/bibliotheque" },
  { kind: "strategy", titre: "Ma stratégie", texte: "Votre clientèle, votre positionnement et vos idées marketing.", href: "/studio/strategie" },
];

/** Studio ACCO : la marque, la création, la bibliothèque et la stratégie du client (maquette V3). */
export default async function StudioPage() {
  const { client } = await requireClientContext();
  const offres = await prisma.offer.findMany({ where: { isArchived: false }, orderBy: { order: "asc" }, take: 2, select: { id: true, name: true, benefit: true, slug: true } });
  return (
    <Page title={<><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2.4px] text-text"><span className="size-2 rounded-full bg-yellow" /> Studio ACCO</span>Votre marque. Votre créativité.</>} subtitle={`Tout ce dont ${client.name} a besoin pour communiquer avec cohérence.`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {ENTREES.map((e, i) => (
          <Link key={e.href} href={e.href} className="block rounded-card border border-border bg-surface p-4 transition-colors hover:border-text">
            <Art kind={e.kind} label={`Studio / 0${i + 1}`} />
            <h2 className="mt-4 text-xl font-bold text-title">{e.titre}.</h2>
            <p className="mt-1 text-sm text-text">{e.texte}</p>
            <p className="mt-3 text-sm font-semibold text-title underline underline-offset-4">Explorer ↗</p>
          </Link>
        ))}
      </div>
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3"><h2 className="text-xl font-bold text-title">Envie d’aller plus loin ?</h2><Link href="/offres" className="text-sm text-text underline-offset-4 hover:underline">Tous nos services ↗</Link></div>
        <div className="grid gap-3">
          {offres.map((o, i) => (
            <Link key={o.id} href={`/offres#${o.slug}`} className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 transition-colors hover:border-text">
              <Art kind={i === 0 ? "print" : "social"} label="ACCO / Services" className="h-28 w-[36%] shrink-0" />
              <div className="min-w-0"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-text"><span className="size-2 rounded-full bg-green" /> Aller plus loin</p><h3 className="mt-1 text-lg font-bold text-title">{o.name}.</h3><p className="text-sm text-text">{o.benefit}</p><p className="mt-2 text-sm font-semibold text-title underline underline-offset-4">Découvrir la prestation ↗</p></div>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}
