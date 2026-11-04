import { ArrowLeftRightIcon, HistoryIcon, UsersIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireDroit } from "@/lib/auth";
import { SectionTitle } from "@/components/ui/card";
import { PIPELINE, fmtDay, fmtDayTime, teamName } from "@/lib/crm";
import { EQUIPE, ROLE_LABEL, MODE_LABEL } from "@/lib/roles";
import { droitsDe } from "@/lib/permissions";
import { AddMemberForm, DelegationForm, DroitsEditor, ModeSelect, PresetMenu, RemoveButton, RoleSelect, TerminerDelegationButton } from "./form";

export const metadata = { title: "Équipe" };

/** Membres, rôles, modes de démarrage, droits unitaires et délégations (sections 2.2, 3.3, 20.1). Droit « equipe » requis. */
export default async function EquipePage() {
  const me = await requireDroit("equipe");
  const now = new Date();
  const [members, delegations, clients, journal] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: EQUIPE } },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true, role: true, droits: true, modeDefaut: true, _count: { select: { crmProspects: { where: { statut: { in: PIPELINE } } }, clientsSuivis: true, clientsDeveloppes: true } } },
    }),
    prisma.delegation.findMany({ where: { fin: { gte: now } }, orderBy: { debut: "asc" }, include: { de: { select: { firstName: true, email: true } }, vers: { select: { firstName: true, email: true } }, client: { select: { name: true } } } }),
    prisma.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.activite.findMany({ where: { kind: { in: ["equipe", "delegation"] } }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { firstName: true, email: true } } } }),
  ]);
  const membres = members.map((m) => ({ id: m.id, nom: `${teamName(m)} (${ROLE_LABEL[m.role]})` }));
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-8">
      <h1 className="text-2xl">Équipe</h1>
      <p className="mt-1 text-sm text-text">Le rôle ouvre les modules ; le mode est la vue de démarrage ; les droits unitaires s’ajoutent un à un (Lucas : Direction sans administration). Tout changement est journalisé.</p>
      <SectionTitle icon={UsersIcon}>Membres</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {members.map((m) => {
          const implicites = droitsDe({ ...m, droits: [] });
          return (
            <li key={m.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-title">{[m.firstName, m.lastName].filter(Boolean).join(" ") || teamName(m)}</p>
                  <p className="truncate text-xs text-text">{m.email} · {m._count.crmProspects} prospect{m._count.crmProspects > 1 ? "s" : ""} en cours · {m._count.clientsSuivis + m._count.clientsDeveloppes} client{m._count.clientsSuivis + m._count.clientsDeveloppes > 1 ? "s" : ""}{m.modeDefaut ? ` · démarre en ${MODE_LABEL[m.modeDefaut]}` : ""}</p>
                </div>
                <RoleSelect id={m.id} role={m.role} self={m.id === me.id} />
                <ModeSelect id={m.id} role={m.role} mode={m.modeDefaut} />
                <PresetMenu id={m.id} self={m.id === me.id} />
                {m.id !== me.id && <RemoveButton id={m.id} name={m.firstName ?? m.email} />}
              </div>
              <DroitsEditor id={m.id} droits={m.droits} implicites={implicites} self={m.id === me.id} />
            </li>
          );
        })}
      </ul>
      <SectionTitle>Ajouter un membre</SectionTitle>
      <AddMemberForm />

      <SectionTitle icon={ArrowLeftRightIcon}>Délégations de portefeuille</SectionTitle>
      <p className="mb-3 text-sm text-text">Temporaire et datée : le délégataire agit comme référent (validations, relances, rendez-vous) jusqu’à la date de fin, puis le référent reprend la main automatiquement. La réattribution définitive se fait depuis la fiche client.</p>
      {delegations.length > 0 && (
        <ul className="mb-3 divide-y divide-border rounded-card border border-border bg-surface">
          {delegations.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-title">{teamName(d.de)} → <span className="font-semibold">{teamName(d.vers)}</span> · {d.client ? d.client.name : "tout le portefeuille"}</p>
                <p className="text-xs text-text">Du {fmtDay(d.debut)} au {fmtDay(d.fin)}{d.debut > now ? " (à venir)" : " (en cours)"}{d.motif ? ` · ${d.motif}` : ""}</p>
              </div>
              <TerminerDelegationButton id={d.id} />
            </li>
          ))}
        </ul>
      )}
      <DelegationForm membres={membres} clients={clients.map((c) => ({ id: c.id, nom: c.name }))} />

      <SectionTitle icon={HistoryIcon}>Journal des accès</SectionTitle>
      {journal.length === 0 ? <p className="text-sm text-text">Aucun changement enregistré.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {journal.map((a) => <li key={a.id} className="px-4 py-2 text-xs text-text"><span className="text-title">{a.texte}</span> · {a.user ? teamName(a.user) : "système"} · {fmtDayTime(a.createdAt)}</li>)}
        </ul>
      )}
    </main>
  );
}
