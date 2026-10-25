import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Espaces } from "@/components/espaces/espaces";
import { todayBounds } from "@/lib/crm";

export const metadata = { title: "Accueil" };

/** Accueil de l'équipe : deux espaces, le suivi des clients (portail) et le suivi commercial (CRM). */
export default async function AdminHome() {
  const user = await requireAdmin();
  const { start, end } = todayBounds();
  const [changes, orders, referrals, docs, relances, rdv] = await Promise.all([
    prisma.changeRequest.count({ where: { status: { not: "TERMINEE" } } }),
    prisma.order.count({ where: { status: "A_TRAITER" } }),
    prisma.referral.count({ where: { status: "ENVOYEE" } }),
    prisma.documentRequest.count({ where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" } }),
    prisma.prospect.count({ where: { statut: { in: ["A_RELANCER", "POSER_RDV", "A_SIGNER"] }, relanceAt: { lt: end } } }),
    prisma.rendezVous.count({ where: { debut: { gte: start, lt: end }, resultat: "PREVU" } }),
  ]);
  const aTraiter = changes + orders + referrals + docs;
  const commercial = relances + rdv;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-3xl">Bonjour{user.firstName ? ` ${user.firstName}` : ""}</h1>
      <p className="mt-1 text-sm text-text">Où va-t-on aujourd’hui ?</p>
      <div className="mt-6">
        <Espaces
          items={[
            {
              href: "/admin/suivi", name: "Suivi client", text: "Clients, sites, modifications, commandes, messages",
              image: "/espaces/suivi-client.webp", accent: "#2f6df6",
              stat: { value: aTraiter, label: aTraiter > 1 ? "choses à traiter" : "chose à traiter" },
            },
            {
              href: "/crm", name: "Suivi commercial", text: "Prospects, pipeline, calendrier, leads et stats",
              image: "/espaces/suivi-commercial.webp", accent: "#1fae6b",
              stat: { value: commercial, label: commercial > 1 ? "relances et RDV aujourd’hui" : "relance ou RDV aujourd’hui" },
            },
          ]}
        />
      </div>
    </main>
  );
}
