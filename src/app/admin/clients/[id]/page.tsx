import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveIcon, StarIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { requireClientAcces } from "@/lib/perimetre";
import { can, estExterne } from "@/lib/permissions";
import { featureEnabled } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { LogoClient } from "@/components/ui/logo-client";
import { FORMULE } from "@/lib/labels";
import { teamName } from "@/lib/crm";
import { cn } from "@/lib/cn";
import { BackLink } from "@/components/ui/back-link";
import { ArchiverButton, LogoForm } from "./forms";
import { Apercu } from "./onglets/apercu";
import { SitesOnglet } from "./onglets/sites";
import { ContratsOnglet } from "./onglets/contrats";
import { ContactsOnglet } from "./onglets/contacts";
import { ActiviteOnglet } from "./onglets/activite";
import { TachesOnglet } from "./onglets/taches";
import { DemandesOnglet } from "./onglets/demandes";
import { DocumentsOnglet } from "./onglets/documents";
import { IntelligenceOnglet } from "./onglets/intelligence";
import { SatisfactionOnglet } from "./onglets/satisfaction";
import { ONGLETS, type Onglet } from "./onglets/ctx";

type SP = { onglet?: string; canal?: string; site?: string; qui?: string; periode?: string; contact?: string };

/**
 * Fiche client (section 4) : page principale récapitulative + onglets. Les externes n'y accèdent que pour les clients de
 * leurs projets ; finance et notes internes selon les droits.
 */
export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const me = await requireTeam();
  const { id } = await params;
  const sp = await searchParams;
  await requireClientAcces(me, id);
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, secteur: true, statut: true, archivedAt: true, reference: true, formule: true, logoMiniPath: true, logoPath: true, phone: true, email: true, address: true, siren: true, gmbUrl: true, createdAt: true, commercialId: true, developpeurId: true, commercial: { select: { id: true, firstName: true, email: true } }, developpeur: { select: { id: true, firstName: true, email: true } }, _count: { select: { sites: true, contrats: true, contacts: true } } },
  });
  if (!client) notFound();
  const externe = estExterne(me);
  const ia = !externe && (await featureEnabled("feature_ai"));
  const onglets = ONGLETS.filter(([k]) => (k !== "intelligence" || ia) && !(externe && (k === "satisfaction" || k === "contrats")));
  const onglet: Onglet = (onglets.some(([k]) => k === sp.onglet) ? sp.onglet : "apercu") as Onglet;
  const ctx = { clientId: client.id, me, finance: can(me, "finance"), externe, sp };

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-8 lg:py-8">
      <BackLink fallback="/admin/clients" label="Clients" />
      <header className="mt-3 flex flex-wrap items-start gap-4">
        <LogoForm clientId={client.id} logo={client.logoMiniPath} name={client.name} externe={externe} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl">
            {client.reference && <StarIcon size={18} className="shrink-0 fill-yellow text-yellow" aria-label="Client référence" />}
            <span className="min-w-0 truncate">{client.name}</span>
            {client.formule && <Badge tone={FORMULE[client.formule].tone}>{FORMULE[client.formule].label}</Badge>}
            {client.statut === "ARCHIVE" && <Badge tone="neutral"><ArchiveIcon size={11} /> Archivé</Badge>}
            {client.statut === "SUSPENDU" && <Badge tone="pink">Suspendu</Badge>}
          </h1>
          <p className="mt-1 text-sm text-text">
            {client.secteur ? <>{client.secteur} · </> : null}
            Référent <span className="font-semibold text-text-strong">{client.commercial ? teamName(client.commercial) : "personne"}</span>
            {client.developpeur && <> · développeur <span className="font-semibold text-text-strong">{teamName(client.developpeur)}</span></>}
            {" · "}{client._count.sites} site{client._count.sites > 1 ? "s" : ""} · {client._count.contrats} contrat{client._count.contrats > 1 ? "s" : ""}
          </p>
        </div>
        {can(me, "archiver") && <ArchiverButton clientId={client.id} archive={client.statut === "ARCHIVE"} />}
      </header>

      <nav className="sticky top-14 z-10 -mx-4 mt-5 border-b border-border bg-bg/95 px-4 backdrop-blur" aria-label="Onglets de la fiche">
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {onglets.map(([k, label]) => (
            <li key={k} className="shrink-0">
              <Link href={`/admin/clients/${client.id}${k === "apercu" ? "" : `?onglet=${k}`}`} className={cn("-mb-px block border-b-2 px-2.5 py-2.5 text-sm", onglet === k ? "border-title font-semibold text-title" : "border-transparent text-text hover:text-title")}>{label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5">
        {onglet === "apercu" && <Apercu {...ctx} ia={ia} />}
        {onglet === "sites" && <SitesOnglet {...ctx} />}
        {onglet === "contrats" && !externe && <ContratsOnglet {...ctx} />}
        {onglet === "contacts" && <ContactsOnglet {...ctx} />}
        {(onglet === "activite" || onglet === "emails" || onglet === "appels") && <ActiviteOnglet {...ctx} mode={onglet} />}
        {onglet === "taches" && <TachesOnglet {...ctx} />}
        {onglet === "demandes" && <DemandesOnglet {...ctx} />}
        {onglet === "documents" && <DocumentsOnglet {...ctx} />}
        {onglet === "intelligence" && ia && <IntelligenceOnglet {...ctx} />}
        {onglet === "satisfaction" && !externe && <SatisfactionOnglet {...ctx} />}
      </div>
    </main>
  );
}
