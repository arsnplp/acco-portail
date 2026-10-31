import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { addDays, fmtPrice } from "@/lib/format";
import { ROLE_LABEL, EQUIPE } from "@/lib/roles";
import { ChartColumnIcon, UsersIcon } from "lucide-react";

export const metadata = { title: "Pilotage" };

/** Module Pilotage (Direction) : santé de la société. Première version : MRR, clients, équipe. Projection et activité par collaborateur : phase suivante. */
export default async function PilotagePage() {
  await requireAdmin();
  const in60 = addDays(60);
  const [mrr, actifs, clients, sitesEnLigne, equipe, engagements] = await Promise.all([
    prisma.subscription.aggregate({ where: { status: "ACTIF", billing: "MENSUEL" }, _sum: { priceCents: true } }),
    prisma.subscription.count({ where: { status: "ACTIF" } }),
    prisma.client.count(),
    prisma.site.count({ where: { status: "EN_LIGNE" } }),
    prisma.user.findMany({ where: { role: { in: EQUIPE } }, orderBy: [{ role: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, email: true, role: true, _count: { select: { clientsSuivis: true, clientsDeveloppes: true, crmProspects: true } } } }),
    prisma.subscription.count({ where: { status: "ACTIF", commitmentEndsAt: { gte: new Date(), lte: in60 } } }),
  ]);
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
      <p className="mt-3 text-xs text-muted">Projection du MRR sur les prochains mois, activité et performances par collaborateur, historique global : prochaine étape.</p>

      <SectionTitle icon={UsersIcon}>Équipe</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {equipe.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-title">{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}</p>
              <p className="truncate text-xs text-text">{u.email}</p>
            </div>
            <span className="hidden text-xs text-text sm:inline">{u._count.clientsSuivis} client{u._count.clientsSuivis > 1 ? "s" : ""} suivi{u._count.clientsSuivis > 1 ? "s" : ""} · {u._count.clientsDeveloppes} développé{u._count.clientsDeveloppes > 1 ? "s" : ""} · {u._count.crmProspects} prospect{u._count.crmProspects > 1 ? "s" : ""}</span>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text">{ROLE_LABEL[u.role]}</span>
          </li>
        ))}
      </ul>
    </AdminPage>
  );
}
