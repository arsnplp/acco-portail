import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { addDays } from "@/lib/format";

export const metadata = { title: "Tableau de bord" };

export default async function AdminHome() {
  const in60 = addDays(60);
  const [openChanges, ordersTodo, newReferrals, endingSoon, clients, sites, docRequests] = await Promise.all([
    prisma.changeRequest.count({ where: { status: { not: "TERMINEE" } } }),
    prisma.order.count({ where: { status: "A_TRAITER" } }),
    prisma.referral.count({ where: { status: "ENVOYEE" } }),
    prisma.subscription.count({ where: { status: "ACTIF", commitmentEndsAt: { lte: in60, gte: new Date() } } }),
    prisma.client.count(),
    prisma.site.count(),
    prisma.documentRequest.count({ where: { status: "EN_ATTENTE", direction: "VERS_EQUIPE" } }),
  ]);

  const tiles: Array<[string, number, string]> = [
    ["Demandes de modif ouvertes", openChanges, "/admin/modifications"],
    ["Commandes à traiter", ordersTodo, "/admin/commandes"],
    ["Demandes de documents", docRequests, "/admin/documents"],
    ["Nouvelles recommandations", newReferrals, "/admin/recommandations"],
    ["Engagements qui se terminent sous 60 j", endingSoon, "/admin/clients"],
    ["Clients", clients, "/admin/clients"],
    ["Sites", sites, "/admin/sites"],
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="text-2xl">Tableau de bord</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, n, href]) => (
          <Card key={label} href={href}>
            <p className="text-3xl font-title font-extrabold text-title">{n}</p>
            <p className="mt-1 text-sm text-text">{label}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
