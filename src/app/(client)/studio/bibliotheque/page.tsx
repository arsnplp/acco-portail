/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { FolderOpenIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { Empty } from "@/components/ui/empty";
import { signedUrl } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { PIECE_KINDS } from "@/lib/charte";

export const metadata = { title: "Ma bibliothèque" };

/** Studio / Ressources : logos et fichiers de marque (DA des sites) + documents déposés. */
export default async function BibliothequePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { client } = await requireClientContext();
  const { f } = await searchParams;
  const [pieces, docs] = await Promise.all([
    prisma.chartePiece.findMany({ where: { charte: { site: { clientId: client.id }, publieeAt: { not: null } } }, orderBy: { createdAt: "asc" }, include: { charte: { select: { site: { select: { name: true } } } } } }),
    prisma.document.findMany({ where: { clientId: client.id, kind: { in: ["AUTRE", "BRIEF"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const items = [
    ...(await Promise.all(pieces.map(async (p) => ({ id: p.id, nom: p.fileName, cat: p.kind === "logo" ? "Logos" : p.kind === "police" ? "Polices" : "Documents", sous: `${PIECE_KINDS[p.kind] ?? p.kind} · ${p.charte.site.name}`, url: await signedUrl("site-assets", p.storagePath, 3600), image: /^image\//.test(p.contentType ?? "") })))),
    ...(await Promise.all(docs.map(async (d) => ({ id: d.id, nom: d.title, cat: "Documents", sous: fmtDate(d.createdAt), url: await signedUrl("documents", d.storagePath, 3600), image: /\.(png|jpe?g|webp|gif)$/i.test(d.fileName) })))),
  ];
  const cats = ["Tout", "Logos", "Polices", "Documents"];
  const filtre = f && cats.includes(f) ? f : "Tout";
  const visibles = items.filter((i) => filtre === "Tout" || i.cat === filtre);
  return (
    <Page title="Ma bibliothèque." subtitle="Vos ressources au même endroit, prêtes à être utilisées.">
      <div className="-mt-4 mb-4"><BackLink fallback="/studio" label="Studio" /></div>
      <div className="mb-4 flex flex-wrap gap-2">{cats.map((c) => <Link key={c} href={c === "Tout" ? "/studio/bibliotheque" : `/studio/bibliotheque?f=${c}`} className={`rounded-full border px-4 py-2 text-sm font-medium ${filtre === c ? "border-title bg-title text-bg" : "border-border text-text"}`}>{c}</Link>)}</div>
      {visibles.length === 0 ? <Empty icon={FolderOpenIcon} title="Rien pour l’instant" text="Votre logo, vos polices et vos fichiers de marque apparaîtront ici à la livraison de votre site. Vos documents partagés aussi." /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibles.map((i) => (
            <a key={i.id} href={i.url ?? "#"} target="_blank" rel="noreferrer" className="rounded-card border border-border bg-surface p-3 transition-colors hover:border-text">
              <div className="flex h-28 items-center justify-center rounded-lg bg-[repeating-conic-gradient(#8883_0_25%,transparent_0_50%)] bg-[length:16px_16px]">{i.image && i.url ? <img src={i.url} alt="" className="max-h-24 max-w-full object-contain" /> : <span className="text-xs font-semibold uppercase text-text">{i.nom.split(".").pop()?.slice(0, 4)}</span>}</div>
              <p className="mt-2 truncate text-sm font-semibold text-title">{i.nom}</p>
              <p className="truncate text-[11px] text-text">{i.sous}</p>
            </a>
          ))}
        </div>
      )}
      <p className="mt-6 text-sm text-text">Vos contrats et devis sont dans <Link href="/compte/documents" className="underline">Mon compte → Documents</Link>.</p>
    </Page>
  );
}
