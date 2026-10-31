import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { Espaces, type Espace } from "@/components/espaces/espaces";
import { todayBounds } from "@/lib/crm";
import { canAccess } from "@/lib/roles";

export const metadata = { title: "Accueil" };

/** Accueil de l'équipe : les modules auxquels le rôle donne accès (Pilotage, Prospection, Suivi). */
export default async function AdminHome() {
  const user = await requireTeam();
  const { start, end } = todayBounds();
  const [changes, orders, referrals, docs, relances, rdv, mrr] = await Promise.all([
    prisma.changeRequest.count({ where: { status: { not: "TERMINEE" } } }),
    prisma.order.count({ where: { status: "A_TRAITER" } }),
    prisma.referral.count({ where: { status: "ENVOYEE" } }),
    prisma.documentRequest.count({ where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" } }),
    prisma.prospect.count({ where: { statut: { in: ["A_RELANCER", "POSER_RDV", "A_SIGNER"] }, relanceAt: { lt: end } } }),
    prisma.rendezVous.count({ where: { debut: { gte: start, lt: end }, resultat: "PREVU" } }),
    prisma.subscription.aggregate({ where: { status: "ACTIF", billing: "MENSUEL" }, _sum: { priceCents: true } }),
  ]);
  const aTraiter = changes + orders + referrals + docs;
  const commercial = relances + rdv;
  const euros = Math.round((mrr._sum.priceCents ?? 0) / 100);

  const modules: Espace[] = [
    ...(canAccess(user.role, "pilotage") ? [{
      href: "/admin/pilotage", name: "Pilotage", text: "Santé de la société, MRR, activité de l’équipe",
      image: "/espaces/suivi-client.webp", accent: "#d97757",
      stat: { value: euros, label: "€ de revenu mensuel récurrent" },
    }] : []),
    ...(canAccess(user.role, "prospection") ? [{
      href: "/crm", name: "Prospection", text: "Prospects, pipeline, calendrier, leads et stats",
      image: "/espaces/suivi-commercial.webp", accent: "#1fae6b",
      stat: { value: commercial, label: commercial > 1 ? "relances et RDV aujourd’hui" : "relance ou RDV aujourd’hui" },
    }] : []),
    {
      href: "/admin/suivi", name: "Suivi", text: "Clients, sites, production, modifications, messages",
      image: "/espaces/suivi-client.webp", accent: "#2f6df6",
      stat: { value: aTraiter, label: aTraiter > 1 ? "choses à traiter" : "chose à traiter" },
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-3xl">Bonjour{user.firstName ? ` ${user.firstName}` : ""}</h1>
      <p className="mt-1 text-sm text-text">Où va-t-on aujourd’hui ?</p>
      <div className="mt-6"><Espaces items={modules} /></div>
    </main>
  );
}
