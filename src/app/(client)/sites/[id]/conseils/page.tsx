import { ExternalLinkIcon, LightbulbIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { requireClientSite } from "@/lib/sites";
import { conseilsPourSite } from "@/lib/conseils";
import { Card, SectionTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { cn } from "@/lib/cn";

export const metadata = { title: "Conseils" };

const PRIO = { 1: { label: "À faire en premier", cls: "bg-pink/15 text-pink" }, 2: { label: "Cette semaine", cls: "bg-yellow/15 text-yellow" }, 3: { label: "Quand vous pouvez", cls: "bg-surface-2 text-text" } } as const;

/** Conseils business : recommandations automatiques pour développer la visibilité du commerce. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const conseils = await conseilsPourSite(site.id);
  if (conseils.length === 0) return <Empty icon={LightbulbIcon} title="Rien à signaler" text="Votre présence en ligne est bien en place. On vous dit dès qu’il y a quelque chose à faire." />;
  return (
    <div>
      <SectionTitle icon={SparklesIcon}>Vos prochaines actions</SectionTitle>
      <p className="-mt-2 mb-3 text-sm text-text">Des recommandations simples, calculées à partir de votre site, de votre fiche Google et de vos avis. Mises à jour chaque semaine.</p>
      <div className="grid gap-3">
        {conseils.map((c) => {
          const p = PRIO[c.priorite];
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-title">{c.titre}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", p.cls)}>{p.label}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-text-strong">{c.texte}</p>
              {c.href && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue">{c.externe ? "Ouvrir" : "Y aller"} {c.externe && <ExternalLinkIcon size={11} />}</p>}
            </>
          );
          if (c.href && c.externe) return <a key={c.id} href={c.href} target="_blank" rel="noreferrer" className="block rounded-card border border-border bg-surface p-4 transition-colors hover:border-text">{inner}</a>;
          if (c.href) return <Link key={c.id} href={c.href} className="block rounded-card border border-border bg-surface p-4 transition-colors hover:border-text">{inner}</Link>;
          return <Card key={c.id}>{inner}</Card>;
        })}
      </div>
    </div>
  );
}
