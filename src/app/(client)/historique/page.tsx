import Link from "next/link";
import { HistoryIcon, GlobeIcon, WrenchIcon, NewspaperIcon, FileSignatureIcon, FileTextIcon, CalendarCheckIcon, PuzzleIcon, LifeBuoyIcon, PhoneIcon, type LucideIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { Page } from "@/components/page";
import { Empty } from "@/components/ui/empty";
import { historiqueClient, moisLabel, type Evenement } from "@/lib/historique";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Historique" };

const ICONE: Record<Evenement["kind"], LucideIcon> = { site: GlobeIcon, modification: WrenchIcon, article: NewspaperIcon, contrat: FileSignatureIcon, document: FileTextIcon, rdv: CalendarCheckIcon, service: PuzzleIcon, difficulte: LifeBuoyIcon, echange: PhoneIcon };

/** Historique général : tout ce qu'Acco a fait pour le client, mois par mois. */
export default async function HistoriquePage() {
  const { client } = await requireClientContext();
  const evenements = await historiqueClient(client.id);
  const groupes: { mois: string; items: Evenement[] }[] = [];
  for (const e of evenements) {
    const mois = moisLabel(e.date);
    const g = groupes[groupes.length - 1];
    if (g && g.mois === mois) g.items.push(e); else groupes.push({ mois, items: [e] });
  }
  return (
    <Page title="Historique" subtitle={`Tout ce que nous avons fait pour ${client.name}, du plus récent au plus ancien.`}>
      {evenements.length === 0 ? <Empty icon={HistoryIcon} title="Rien pour l’instant" text="Chaque étape, modification, article, document ou rendez-vous apparaîtra ici." /> : groupes.map((g) => (
        <section key={g.mois} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text">{g.mois} <span className="font-normal normal-case tracking-normal">· {g.items.length} action{g.items.length > 1 ? "s" : ""}</span></h2>
          <ol className="space-y-2 border-l border-border pl-4">
            {g.items.map((e) => {
              const Icone = ICONE[e.kind];
              const inner = (
                <>
                  <span className="absolute -left-[25px] top-2.5 flex size-4 items-center justify-center rounded-full border border-border bg-bg"><Icone size={10} className="text-text" aria-hidden /></span>
                  <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-title">{e.titre}{e.site ? <span className="font-normal text-text"> · {e.site}</span> : null}</p><span className="shrink-0 text-[11px] text-text">{fmtDate(e.date)}</span></div>
                  {e.detail && <p className="mt-0.5 text-sm text-text-strong">{e.detail}</p>}
                  {e.puces && e.puces.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-text">{e.puces.map((p, i) => <li key={i}>{p}</li>)}</ul>}
                </>
              );
              const cls = "relative block rounded-card border border-border bg-surface px-3 py-2.5";
              return <li key={e.id}>{e.href ? <Link href={e.href} className={`${cls} transition-colors hover:border-text`}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
            })}
          </ol>
        </section>
      ))}
    </Page>
  );
}
