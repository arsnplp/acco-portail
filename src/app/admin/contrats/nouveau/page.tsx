import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { activePromo } from "@/lib/offers";
import { parisDay } from "@/lib/crm";
import { ContratForm } from "../form";

export const metadata = { title: "Nouveau contrat" };

/** Générateur commun : `?prospect=` depuis Prospection, `?client=` depuis la fiche Suivi (5.1). */
export default async function NouveauContratPage({ searchParams }: { searchParams: Promise<{ prospect?: string; client?: string }> }) {
  const me = await requireTeam();
  if (estExterne(me)) redirect("/admin");
  const sp = await searchParams;
  const [prospect, client, offres] = await Promise.all([
    sp.prospect ? prisma.prospect.findUnique({ where: { id: sp.prospect }, select: { id: true, societe: true, clientId: true, client: { select: { id: true, sites: { select: { id: true, name: true } } } } } }) : null,
    sp.client ? prisma.client.findUnique({ where: { id: sp.client }, select: { id: true, name: true, formule: true, sites: { select: { id: true, name: true } } } }) : null,
    prisma.offer.findMany({ where: { isArchived: false }, orderBy: { order: "asc" }, include: { promotions: true, parent: { select: { name: true } } } }),
  ]);
  if (!prospect && !client) notFound();
  const sites = client?.sites ?? prospect?.client?.sites ?? [];
  const pour = client ? client.name : prospect!.societe;
  return (
    <AdminPage title="Nouveau contrat" back={client ? { href: `/admin/clients/${client.id}?onglet=contrats`, label: pour } : { href: `/crm/prospects/${prospect!.id}`, label: pour }}>
      <ContratForm
        pour={pour}
        prospectId={prospect?.id ?? null}
        clientId={client?.id ?? prospect?.clientId ?? null}
        sites={sites}
        offres={offres.map((o) => ({ id: o.id, name: o.name, billing: o.billing, prix: activePromo(o)?.price ?? o.priceCents, setup: o.setupCents ?? 0, parentName: o.parent?.name ?? null }))}
        init={{ titre: "", formule: client?.formule ?? null, moyenPaiement: null, dureeMois: 24, reconductionMois: 24, preavisJours: 30, debutEngagement: parisDay(), siteId: sites.length === 1 ? sites[0].id : null, lignes: [] }}
      />
    </AdminPage>
  );
}
