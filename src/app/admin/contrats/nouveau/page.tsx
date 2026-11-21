import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BuildingIcon, SearchIcon, UserRoundIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { LogoClient } from "@/components/ui/logo-client";
import { activePromo } from "@/lib/offers";
import { parisDay } from "@/lib/crm";
import { STATUT } from "@/lib/crm";
import { infosClientDe, type ContratComplet } from "@/lib/contrats";
import { ContratForm } from "../form";

export const metadata = { title: "Nouveau contrat" };

/**
 * Générateur de contrat (équipe). Étape 1 : choisir le client (ou le prospect) ; étape 2 : le formulaire, prérempli avec ce qu'on sait,
 * les champs manquants en jaune à compléter à la main. Accessible aussi avec `?prospect=` (Prospection) ou `?client=` (fiche client).
 */
export default async function NouveauContratPage({ searchParams }: { searchParams: Promise<{ prospect?: string; client?: string; q?: string }> }) {
  const me = await requireTeam();
  if (estExterne(me)) redirect("/admin");
  const sp = await searchParams;
  if (!sp.prospect && !sp.client) return <ChoixClient q={sp.q ?? ""} />;
  const [prospect, client, offres] = await Promise.all([
    sp.prospect ? prisma.prospect.findUnique({ where: { id: sp.prospect }, select: { id: true, societe: true, adresse: true, siren: true, clientId: true, client: { select: { id: true, sites: { select: { id: true, name: true } } } }, contacts: { where: { email: { not: null } }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, email: true, fonction: true } } } }) : null,
    sp.client ? prisma.client.findUnique({ where: { id: sp.client }, select: { id: true, name: true, formule: true, address: true, siren: true, email: true, formeJuridique: true, siret: true, rcsVille: true, capitalEuros: true, representantNom: true, representantFonction: true, sites: { select: { id: true, name: true } }, contacts: { where: { email: { not: null } }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, email: true, fonction: true } } } }) : null,
    prisma.offer.findMany({ where: { isArchived: false }, orderBy: { order: "asc" }, include: { promotions: true, parent: { select: { name: true } } } }),
  ]);
  if (!prospect && !client) notFound();
  const sites = client?.sites ?? prospect?.client?.sites ?? [];
  const pour = client ? client.name : prospect!.societe;
  // Préremplissage : fiche client (champs légaux), sinon prospect ; signataire = contact principal.
  const contact = client?.contacts[0] ?? prospect?.contacts[0] ?? null;
  const faux = { contenu: null, signataireNom: contact ? [contact.prenom, contact.nom].filter(Boolean).join(" ") : null, signataireEmail: contact?.email ?? null, client: client ? { name: client.name, address: client.address, siren: client.siren, email: client.email, formeJuridique: client.formeJuridique, siret: client.siret, rcsVille: client.rcsVille, capitalEuros: client.capitalEuros, representantNom: client.representantNom, representantFonction: client.representantFonction } : null, prospect: prospect ? { societe: prospect.societe, adresse: prospect.adresse, siren: prospect.siren } : null } as unknown as ContratComplet;
  const infos = infosClientDe(faux);
  if (!infos.fonction && contact?.fonction) infos.fonction = contact.fonction;
  return (
    <AdminPage title="Nouveau contrat" back={client ? { href: `/admin/clients/${client.id}?onglet=contrats`, label: pour } : { href: `/crm/prospects/${prospect!.id}`, label: pour }}>
      <ContratForm
        pour={pour}
        prospectId={prospect?.id ?? null}
        clientId={client?.id ?? prospect?.clientId ?? null}
        sites={sites}
        infos={infos}
        offres={offres.map((o) => ({ id: o.id, name: o.name, billing: o.billing, prix: activePromo(o)?.price ?? o.priceCents, setup: o.setupCents ?? 0, parentName: o.parent?.name ?? null }))}
        init={{ titre: "", formule: client?.formule ?? null, moyenPaiement: null, dureeMois: 24, reconductionMois: 24, preavisJours: 30, debutEngagement: parisDay(), siteId: sites.length === 1 ? sites[0].id : null, lignes: [] }}
      />
    </AdminPage>
  );
}

/** Étape 1 : recherche d'un client ou d'un prospect. */
async function ChoixClient({ q }: { q: string }) {
  const filtre = q.trim();
  const [clients, prospects] = await Promise.all([
    prisma.client.findMany({ where: { archivedAt: null, ...(filtre ? { name: { contains: filtre, mode: "insensitive" } } : {}) }, orderBy: { name: "asc" }, take: filtre ? 30 : 12, select: { id: true, name: true, logoMiniPath: true, address: true, siret: true, representantNom: true } }),
    prisma.prospect.findMany({ where: { clientId: null, statut: { in: ["A_SIGNER", "RDV_POSE", "POSER_RDV", "A_RELANCER"] }, ...(filtre ? { societe: { contains: filtre, mode: "insensitive" } } : {}) }, orderBy: { updatedAt: "desc" }, take: filtre ? 30 : 8, select: { id: true, societe: true, statut: true, adresse: true } }),
  ]);
  return (
    <AdminPage title="Nouveau contrat" back={{ href: "/admin/contrats", label: "Contrats" }}>
      <p className="-mt-3 text-sm text-text">Pour qui ? Choisissez un client existant ou un prospect : le contrat se préremplit avec ce qu’on sait déjà, il ne reste que les champs manquants à compléter.</p>
      <form className="mt-4 flex items-center gap-2"><SearchIcon size={16} className="text-text" /><Input name="q" defaultValue={q} placeholder="Nom de l’entreprise…" autoFocus className="py-2.5" /></form>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-title"><BuildingIcon size={15} className="text-text" /> Clients ({clients.length})</h2>
          <div className="grid gap-2">
            {clients.map((c) => { const ok = c.address && c.siret && c.representantNom; return <Card key={c.id} href={`/admin/contrats/nouveau?client=${c.id}`} className="flex items-center gap-3 py-3"><LogoClient id={c.id} name={c.name} logo={c.logoMiniPath} size={32} /><div className="min-w-0 flex-1"><p className="truncate font-semibold text-title">{c.name}</p><p className="text-xs text-text">{ok ? "Informations légales complètes" : "Des informations à compléter"}</p></div><span className="text-xs text-text">Choisir →</span></Card>; })}
            {clients.length === 0 && <p className="text-sm text-text">Aucun client{filtre ? ` pour « ${filtre} »` : ""}.</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-title"><UserRoundIcon size={15} className="text-text" /> Prospects en cours ({prospects.length})</h2>
          <div className="grid gap-2">
            {prospects.map((p) => <Card key={p.id} href={`/admin/contrats/nouveau?prospect=${p.id}`} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-title">{p.societe}</p><p className="text-xs text-text">{STATUT[p.statut].label}{p.adresse ? ` · ${p.adresse}` : ""}</p></div><span className="text-xs text-text">Choisir →</span></Card>)}
            {prospects.length === 0 && <p className="text-sm text-text">Aucun prospect{filtre ? ` pour « ${filtre} »` : ""}.</p>}
          </div>
          <p className="mt-2 text-xs text-muted">Un contrat signé par un prospect crée sa fiche client et son portail automatiquement. <Link href="/crm/prospects" className="underline">Tous les prospects</Link></p>
        </section>
      </div>
    </AdminPage>
  );
}
