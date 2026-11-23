import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { lireCharte } from "@/lib/charte";
import { conseilsPourClient, PRIO_CONSEIL } from "@/lib/conseils";
import { cn } from "@/lib/cn";

export const metadata = { title: "Ma stratégie" };

/** Studio / Marketing : esprit de marque et façon de communiquer (DA) + prochaines actions (conseils). */
export default async function StrategiePage() {
  const { client } = await requireClientContext();
  const [sites, conseils] = await Promise.all([
    prisma.site.findMany({ where: { clientId: client.id, charte: { publieeAt: { not: null } } }, select: { id: true, name: true, charte: { select: { contenu: true } } } }),
    conseilsPourClient(client.id),
  ]);
  const chartes = sites.map((s) => ({ site: s, c: lireCharte(s.charte?.contenu) })).filter((x) => x.c.espritTexte || x.c.ton || x.c.conseils.length);
  return (
    <Page title="Ma stratégie." subtitle="Des repères simples pour prendre les bonnes décisions de communication.">
      <div className="-mt-4 mb-4"><BackLink fallback="/studio" label="Studio" /></div>
      {chartes.length === 0 && conseils.length === 0 && <Empty icon={CompassIcon} title="Votre stratégie arrive" text="Positionnement, clientèle, ton et prochaines actions apparaîtront ici dès la livraison de votre site." />}
      {chartes.map(({ site, c }) => (
        <div key={site.id} className="mb-6 grid gap-3">
          {sites.length > 1 && <p className="text-xs font-semibold uppercase tracking-wide text-text">{site.name}</p>}
          {c.espritTexte && <Card><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-text"><span className="size-2 rounded-full bg-yellow" /> Positionnement</p><h2 className="mt-2 text-xl font-bold text-title">{c.espritTexte}</h2>{c.adjectifs.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{c.adjectifs.map((a) => <span key={a} className="rounded-full border border-border px-3 py-1 text-sm text-text-strong">{a}</span>)}</div>}</Card>}
          {c.ressenti && <Card><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-text"><span className="size-2 rounded-full bg-yellow" /> Clientèle cible</p><h3 className="mt-2 text-lg font-bold text-title">Ce que vos clients doivent ressentir</h3><p className="mt-1 text-sm text-text">{c.ressenti}</p></Card>}
          {c.ton && <Card><h3 className="text-lg font-bold text-title">Votre ton de communication.</h3><p className="mt-1 text-sm text-text">{c.ton}</p>{c.privilegier && <p className="mt-2 text-sm text-green">✓ « {c.privilegier} »</p>}{c.eviter && <p className="mt-1 text-sm text-pink">✗ « {c.eviter} »</p>}</Card>}
          <Link href={`/studio/marque/${site.id}?v=esprit`} className="text-sm font-semibold text-title underline underline-offset-4">Voir ma DA complète ↗</Link>
        </div>
      ))}
      {conseils.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3"><h2 className="text-xl font-bold text-title">Vos prochaines opportunités.</h2><Link href="/conseils" className="text-sm text-text underline-offset-4 hover:underline">Tous les conseils ↗</Link></div>
          <Card className="divide-y divide-border p-0">{conseils.slice(0, 4).map((c) => <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3"><div><p className="font-semibold text-title">{c.titre}</p><p className="mt-0.5 text-sm text-text">{c.texte}</p></div><span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIO_CONSEIL[c.priorite].cls)}>{PRIO_CONSEIL[c.priorite].label}</span></div>)}</Card>
        </section>
      )}
      <Card className="mt-6"><h3 className="text-lg font-bold text-title">Un expert à vos côtés.</h3><p className="mt-1 text-sm text-text">Faites le point sur votre stratégie et vos opportunités avec votre équipe ACCO.</p><Link href="/messages" className="mt-3 inline-block text-sm font-semibold text-title underline underline-offset-4">Écrire à mon équipe ↗</Link></Card>
    </Page>
  );
}
