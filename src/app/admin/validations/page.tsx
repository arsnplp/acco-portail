import { ClipboardCheckIcon, HistoryIcon } from "lucide-react";
import { requireTeam } from "@/lib/auth";
import { SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDayTime, teamName } from "@/lib/crm";
import { decideesRecentes, enAttentePour } from "@/lib/validations";
import { ValidationsEnAttente } from "./liste";
import { versItem } from "./items";

export const metadata = { title: "Validations" };

/** Centre des validations (section 20.1) : les miennes (et celles des référents que je remplace), puis l'historique récent. */
export default async function ValidationsPage() {
  const me = await requireTeam();
  const [attente, recentes] = await Promise.all([enAttentePour(me.id), decideesRecentes(me.id)]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      <h1 className="text-2xl">Validations</h1>
      <p className="mt-1 text-sm text-text">Chaque circuit garde son contexte : prix et contrats (Bilel, Lucas), briefs et maquettes (commercial puis technique), mise en ligne (Arsène), envois groupés.</p>
      <SectionTitle icon={ClipboardCheckIcon}>En attente de ma validation ({attente.length})</SectionTitle>
      <ValidationsEnAttente items={attente.map((v) => versItem(v, me.id))} />
      <SectionTitle icon={HistoryIcon}>Décidées ces 30 derniers jours</SectionTitle>
      {recentes.length === 0 ? <p className="text-sm text-text">Aucune décision récente.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {recentes.map((v) => {
            const i = versItem(v, me.id);
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <Badge tone={v.statut === "VALIDEE" ? "green" : "pink"}>{v.statut === "VALIDEE" ? "Validée" : "Refusée"}</Badge>
                <span className="font-semibold text-title">{i.label}</span>
                <span className="text-xs text-text">{i.contexte?.texte}{i.contexte ? " · " : ""}{v.decidePar ? `par ${teamName(v.decidePar)}` : ""}{v.decideAt ? ` le ${fmtDayTime(v.decideAt)}` : ""}{v.motif ? ` · ${v.motif}` : ""}</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
