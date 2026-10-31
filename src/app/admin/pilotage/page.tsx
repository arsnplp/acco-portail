import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { addDays, fmtPrice } from "@/lib/format";
import { ROLE_LABEL, EQUIPE } from "@/lib/roles";
import Link from "next/link";
import { fmtDayTime, teamName } from "@/lib/crm";
import { ActivityIcon, ChartColumnIcon, TrendingUpIcon, UsersIcon } from "lucide-react";
import { StackedBars } from "@/app/crm/stats/charts";
import { VIZ } from "@/lib/crm";
import { activiteParCollaborateur, projectionMrr } from "@/lib/pilotage";

export const metadata = { title: "Pilotage" };

/** Module Pilotage (Direction) : santé de la société. Première version : MRR, clients, équipe. Projection et activité par collaborateur : phase suivante. */
export default async function PilotagePage() {
  await requireAdmin();
  const in60 = addDays(60);
  const [mrr, actifs, clients, sitesEnLigne, equipe, engagements, activites, projection, collaborateurs] = await Promise.all([
    prisma.subscription.aggregate({ where: { status: "ACTIF", billing: "MENSUEL" }, _sum: { priceCents: true } }),
    prisma.subscription.count({ where: { status: "ACTIF" } }),
    prisma.client.count(),
    prisma.site.count({ where: { status: "EN_LIGNE" } }),
    prisma.user.findMany({ where: { role: { in: EQUIPE } }, orderBy: [{ role: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, email: true, role: true, _count: { select: { clientsSuivis: true, clientsDeveloppes: true, crmProspects: true } } } }),
    prisma.subscription.count({ where: { status: "ACTIF", commitmentEndsAt: { gte: new Date(), lte: in60 } } }),
    prisma.activite.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { user: { select: { firstName: true, email: true } } } }),
    projectionMrr(),
    activiteParCollaborateur(30),
  ]);
  const euros = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const tiles = [
    { n: fmtPrice(mrr._sum.priceCents ?? 0), label: "MRR (abonnements mensuels actifs)" },
    { n: String(actifs), label: "abonnements actifs" },
    { n: String(clients), label: "clients" },
    { n: String(sitesEnLigne), label: "sites en ligne" },
    { n: String(engagements), label: "engagements à échéance sous 60 jours" },
  ];
  return (
    <AdminPage title="Pilotage">
      <SectionTitle icon={ChartColumnIcon}>Santé de la société</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => <Card key={t.label}><p className="font-title text-2xl font-extrabold text-title">{t.n}</p><p className="mt-1 text-xs text-text">{t.label}</p></Card>)}
      </div>

      <SectionTitle icon={TrendingUpIcon}>Projection du MRR sur 6 mois</SectionTitle>
      <Card>
        <p className="mb-3 text-sm text-text">
          MRR acquis <span className="font-semibold text-title">{euros(projection.mrr)}</span> · à risque sous 3 mois (fins d’engagement) <span className="font-semibold text-pink">{euros(projection.aRisque3Mois)}</span> · pipeline pondéré (RDV posés 25 %, à signer 60 %) <span className="font-semibold text-green">{euros(projection.pondere)}</span> / mois
        </p>
        <StackedBars buckets={projection.points} series={[{ key: "acquis", label: "Acquis (engagement en cours)", color: VIZ.blue }, { key: "risque", label: "Engagement terminé (à renouveler)", color: VIZ.orange }, { key: "pipeline", label: "Pipeline pondéré", color: VIZ.green }]} />
        <p className="mt-2 text-xs text-muted">Hypothèse : un abonnement dont l’engagement se termine passe en orange (à renouveler), le pipeline entre progressivement sur 3 mois.</p>
      </Card>

      <SectionTitle icon={UsersIcon}>Activité par collaborateur <span className="text-sm font-normal text-text">30 derniers jours</span></SectionTitle>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] tracking-wide text-text uppercase">
            <th className="px-3 py-2 font-semibold">Collaborateur</th><th className="px-3 py-2 font-semibold">Rôle</th><th className="px-3 py-2 text-right font-semibold">Échanges</th><th className="px-3 py-2 text-right font-semibold">RDV pris</th><th className="px-3 py-2 text-right font-semibold">Signatures</th><th className="px-3 py-2 text-right font-semibold">CA signé</th><th className="px-3 py-2 text-right font-semibold">Modifs terminées</th><th className="px-3 py-2 text-right font-semibold">Actions</th><th className="px-3 py-2 text-right font-semibold">Clients · sites</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {collaborateurs.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-semibold text-title">{c.nom}</td>
                <td className="px-3 py-2 text-xs text-text">{ROLE_LABEL[c.role]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.echanges}</td><td className="px-3 py-2 text-right tabular-nums">{c.rdv}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.signatures}</td><td className="px-3 py-2 text-right tabular-nums">{c.ca ? euros(c.ca) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.modifs}</td><td className="px-3 py-2 text-right tabular-nums">{c.actions}</td>
                <td className="px-3 py-2 text-right text-xs text-text tabular-nums">{c.clients} · {c.sites}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Échanges : appels, mails, visites, RDV notés (Aircall compris). CA signé : création + 12 mois d’abonnement des prospects gagnés sur la période. {equipe.length} membre{equipe.length > 1 ? "s" : ""} dans l’équipe.</p>

      <SectionTitle icon={ActivityIcon}>Historique global</SectionTitle>
      {activites.length === 0 ? <p className="text-sm text-text">Le flux se remplit au fil des actions de l’équipe (étapes de production, modifications, articles, comptes rendus).</p> : (
        <ol className="space-y-2 border-l border-border pl-4">
          {activites.map((a) => (
            <li key={a.id} className="relative text-sm">
              <span className="absolute top-2 -left-[21px] size-2 rounded-full bg-blue" />
              {a.href ? <Link href={a.href} className="text-text-strong hover:underline">{a.texte}</Link> : <span className="text-text-strong">{a.texte}</span>}
              <p className="text-xs text-text">{fmtDayTime(a.createdAt)}{a.user ? ` · ${teamName(a.user)}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
    </AdminPage>
  );
}
