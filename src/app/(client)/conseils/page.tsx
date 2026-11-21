import { ExternalLinkIcon, LightbulbIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { SectionTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { cn } from "@/lib/cn";
import { iaAutorisee } from "@/lib/ia";
import { conseilsPourClient, PRIO_CONSEIL } from "@/lib/conseils";
import { ConseilsIaButton } from "./bouton";

export const metadata = { title: "Conseils" };

/** Conseils au global (pas par site) : ce que le client peut faire lui-même pour développer son activité. */
export default async function ConseilsPage() {
  const { client } = await requireClientContext();
  const [conseils, ia, sites] = await Promise.all([conseilsPourClient(client.id), iaAutorisee("conseils"), prisma.site.count({ where: { clientId: client.id } })]);
  return (
    <Page title="Conseils" subtitle="Des actions simples, à votre portée, pour faire venir plus de clients.">
      {conseils.length === 0 ? (
        <Empty icon={LightbulbIcon} title={sites ? "Rien à signaler" : "Vos conseils arrivent"} text={sites ? "Votre présence en ligne est bien en place. On vous dit dès qu’il y a quelque chose à faire." : "Dès que votre premier site ou votre fiche Google sera en place, vos conseils personnalisés apparaîtront ici."} />
      ) : (
        <>
          <SectionTitle icon={SparklesIcon}>Vos prochaines actions</SectionTitle>
          <p className="-mt-2 mb-3 text-sm text-text">Réseaux sociaux, fiche Google, avis, bouche-à-oreille : ce que vous pouvez mener vous-même. Ce que nous faisons pour vous n’apparaît pas ici.</p>
          {ia.ok && <div className="mb-3"><ConseilsIaButton /></div>}
          <div className="grid gap-3">
            {conseils.map((c) => {
              const p = PRIO_CONSEIL[c.priorite];
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
              const cls = "block rounded-card border border-border bg-surface p-4 transition-colors hover:border-text";
              if (c.href && c.externe) return <a key={c.id} href={c.href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>;
              if (c.href) return <Link key={c.id} href={c.href} className={cls}>{inner}</Link>;
              return <div key={c.id} className="rounded-card border border-border bg-surface p-4">{inner}</div>;
            })}
          </div>
        </>
      )}
    </Page>
  );
}
