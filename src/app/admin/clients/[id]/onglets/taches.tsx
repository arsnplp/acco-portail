import { CalendarDaysIcon, ListChecksIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDayTime, teamName } from "@/lib/crm";
import { fmtDate } from "@/lib/format";
import { MODULES } from "@/lib/roles";
import { RdvButtons, RdvForm, TacheButtons, TacheForm } from "../forms";
import type { Ctx } from "./ctx";

const TYPE_LABEL = { RELANCE: "Relance", RDV_A_PLANIFIER: "RDV à planifier", APPEL: "Appel", EMAIL: "Email", DOCUMENT: "Document", MAINTENANCE: "Maintenance", AUTRE: "Autre" } as const;
const RESULTAT = { PREVU: ["Prévu", "blue"], FAIT: ["Tenu", "green"], NO_SHOW: ["Absent", "pink"], ANNULE: ["Annulé", "neutral"] } as const;

/** Onglet Tâches & RDV (4.3, section 7) : tâches post-signature avec responsable et échéance, RDV passés et futurs. */
export async function TachesOnglet({ clientId, me }: Ctx) {
  const now = new Date();
  const [taches, rdvs, equipe, sites] = await Promise.all([
    prisma.tacheClient.findMany({ where: { clientId }, orderBy: [{ statut: "asc" }, { echeance: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 100, include: { responsable: { select: { firstName: true, email: true } }, site: { select: { name: true } } } }),
    prisma.rendezVous.findMany({ where: { clientId }, orderBy: { debut: "desc" }, take: 50, include: { commercial: { select: { firstName: true, email: true } }, site: { select: { name: true } } } }),
    prisma.user.findMany({ where: { role: { in: MODULES.suivi } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
    prisma.site.findMany({ where: { clientId }, select: { id: true, name: true } }),
  ]);
  const aFaire = taches.filter((t) => t.statut === "A_FAIRE"), faites = taches.filter((t) => t.statut !== "A_FAIRE");
  const membres = equipe.map((u) => ({ id: u.id, name: teamName(u) }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <SectionTitle icon={ListChecksIcon}>Tâches ({aFaire.length} à faire)</SectionTitle>
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {aFaire.length === 0 && <li className="px-4 py-3 text-sm text-text">Rien à faire pour ce client.</li>}
          {aFaire.map((t) => {
            const retard = t.echeance && t.echeance < now;
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-title">{t.titre} <span className="font-normal text-text">· {TYPE_LABEL[t.type]}</span></p>
                  <p className={`truncate text-xs ${retard ? "text-pink" : "text-text"}`}>{t.echeance ? `${retard ? "En retard · " : ""}${fmtDate(t.echeance)}` : "Sans échéance"} · {t.responsable ? teamName(t.responsable) : "sans responsable"}{t.site ? ` · ${t.site.name}` : ""}{t.description ? ` · ${t.description}` : ""}{t.source ? ` · origine : ${t.source}` : ""}</p>
                </div>
                <TacheButtons clientId={clientId} tacheId={t.id} />
              </li>
            );
          })}
        </ul>
        {faites.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer text-text">{faites.length} terminée{faites.length > 1 ? "s" : ""} ou annulée{faites.length > 1 ? "s" : ""}</summary><ul className="mt-1 space-y-0.5 text-xs text-text">{faites.slice(0, 30).map((t) => <li key={t.id}>{t.statut === "FAIT" ? "✓" : "✕"} {t.titre}{t.faitAt ? ` · ${fmtDate(t.faitAt)}` : ""}{t.responsable ? ` · ${teamName(t.responsable)}` : ""}</li>)}</ul></details>}
        <div className="mt-3"><TacheForm clientId={clientId} membres={membres} sites={sites} meId={me.id} /></div>
      </section>
      <section>
        <SectionTitle icon={CalendarDaysIcon}>Rendez-vous</SectionTitle>
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {rdvs.length === 0 && <li className="px-4 py-3 text-sm text-text">Aucun rendez-vous avec ce client.</li>}
          {rdvs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-title">{fmtDayTime(r.debut)}{r.titre ? ` · ${r.titre}` : ""}</p>
                <p className="truncate text-xs text-text">{r.dureeMin} min{r.lieu ? ` · ${r.lieu}` : ""}{r.site ? ` · ${r.site.name}` : ""}{r.commercial ? ` · ${teamName(r.commercial)}` : ""}{r.meetUrl ? " · Meet" : ""}</p>
              </div>
              <Badge tone={RESULTAT[r.resultat][1]}>{RESULTAT[r.resultat][0]}</Badge>
              {r.resultat === "PREVU" && <RdvButtons clientId={clientId} rdvId={r.id} />}
            </li>
          ))}
        </ul>
        <div className="mt-3"><RdvForm clientId={clientId} membres={membres} sites={sites} meId={me.id} /></div>
      </section>
    </div>
  );
}
