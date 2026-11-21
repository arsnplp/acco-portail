import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LogoClient } from "@/components/ui/logo-client";
import { DIFFICULTE_STATUT, DIFFICULTE_TYPE } from "@/lib/difficultes";
import { fmtDayTime, teamName } from "@/lib/crm";
import { TraiterDifficulteForm } from "@/app/admin/production/difficultes";

export type DifficulteRow = {
  id: string; type: keyof typeof DIFFICULTE_TYPE; statut: keyof typeof DIFFICULTE_STATUT; message: string; reponse: string | null; createdAt: Date; resoluAt: Date | null;
  client: { id: string; name: string; logoMiniPath: string | null }; site: { id: string; name: string } | null; traitePar: { firstName: string | null; email: string } | null;
};

/** Liste des difficultés signalées par les clients, avec le traitement en ligne (Production, fiche client). */
export function DifficultesListe({ items, avecClient = true, vide = "Aucune difficulté signalée." }: { items: DifficulteRow[]; avecClient?: boolean; vide?: string }) {
  if (items.length === 0) return <p className="text-sm text-text">{vide}</p>;
  return (
    <ul className="grid gap-2">
      {items.map((d) => {
        const st = DIFFICULTE_STATUT[d.statut];
        return (
          <li key={d.id} className={`rounded-card border bg-surface p-3 ${d.type === "SITE_EN_PANNE" && d.statut !== "RESOLUE" ? "border-pink/60" : "border-border"}`}>
            <div className="flex flex-wrap items-center gap-2">
              {avecClient && <Link href={`/admin/clients/${d.client.id}?onglet=demandes`} className="flex items-center gap-2 font-semibold text-title hover:underline"><LogoClient id={d.client.id} name={d.client.name} logo={d.client.logoMiniPath} size={22} /> {d.client.name}</Link>}
              <span className="text-sm font-medium text-title">{DIFFICULTE_TYPE[d.type].label}</span>
              {d.site && <Link href={`/admin/sites/${d.site.id}`} className="text-xs text-text hover:underline">{d.site.name}</Link>}
              <Badge tone={st.tone}>{st.label}</Badge>
              <span className="ml-auto text-xs text-text">{fmtDayTime(d.createdAt)}{d.traitePar ? ` · ${teamName(d.traitePar)}` : ""}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm text-text-strong">{d.message}</p>
            <TraiterDifficulteForm id={d.id} statut={d.statut} reponse={d.reponse} />
          </li>
        );
      })}
    </ul>
  );
}
