import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, MailIcon, MapPinIcon, PhoneIcon, SkipForwardIcon, ZapIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/crm/logo";
import { STATUT, contactName, logoUrl, relanceInfo, teamName, parisDay } from "@/lib/crm";
import { EchangeForm, ProspectForm, Contacts, Historique, AssignButton, RdvList } from "./forms";

export const metadata = { title: "Fiche prospect" };

export default async function ProspectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session?: string; skip?: string }> }) {
  const me = await requireTeam();
  const { id } = await params;
  const { session, skip } = await searchParams;
  const [p, team, cibles] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id },
      include: {
        cible: true, commercial: { select: { id: true, firstName: true, email: true } }, client: { select: { id: true, name: true } },
        contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }] },
        echanges: { orderBy: { date: "desc" }, include: { auteur: { select: { firstName: true, email: true } } } },
        rendezVous: { orderBy: { debut: "desc" } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
    prisma.cible.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);
  if (!p) notFound();
  // Échanges avec le client (historique importé, mails) une fois le prospect devenu client.
  const clientEchanges = p.clientId ? await prisma.echange.findMany({ where: { clientId: p.clientId, prospectId: null }, orderBy: { date: "desc" }, include: { auteur: { select: { firstName: true, email: true } } } }) : [];

  const principal = p.contacts[0];
  const name = contactName(principal);
  const phone = principal?.telephone ?? p.telephone;
  const email = p.contacts.find((c) => c.email)?.email;
  const logo = logoUrl(p.siteWeb);
  const r = relanceInfo(p.relanceAt);
  const inSession = session === "1";
  const skipList = [...(skip?.split(",").filter(Boolean) ?? []), p.id].join(",");
  const echanges = [...p.echanges, ...clientEchanges].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <main className="mx-auto max-w-6xl px-4 py-4">
      {inSession && (
        <div className="mb-4 flex items-center gap-3 rounded-card border border-yellow/40 bg-yellow/10 px-4 py-2.5 text-sm text-yellow">
          <ZapIcon size={16} aria-hidden /> Session d’appels : notez l’échange, la fiche suivante s’ouvre toute seule.
          <Link href={`/crm/session?skip=${skipList}`} className="ml-auto flex items-center gap-1 font-semibold hover:underline"><SkipForwardIcon size={14} aria-hidden /> Passer</Link>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface text-base font-semibold text-text-strong">
          <Logo src={logo} name={p.societe} className="size-9" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl leading-tight">{name ?? p.societe}</h1>
          {name && <p className="truncate text-sm text-text">{p.societe}{principal?.fonction ? ` · ${principal.fonction}` : ""}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUT[p.statut].tone}>{STATUT[p.statut].label}</Badge>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.state === "late" ? "bg-pink/15 text-pink" : r.state === "today" ? "bg-yellow/15 text-yellow" : "bg-surface-2 text-text"}`}>Relance : {r.label}</span>
            {p.cible && <span className="text-xs text-text">{p.cible.nom}</span>}
            {p.client && <Link href={`/admin/clients/${p.client.id}`} className="text-xs text-green hover:underline">Client du portail</Link>}
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-card bg-title px-4 text-sm font-semibold text-bg sm:flex-none"><PhoneIcon size={16} aria-hidden /> {phone}</a>}
          {email && <a href={`mailto:${email}`} aria-label="Écrire un mail" className="flex size-11 items-center justify-center rounded-card border border-border text-text hover:text-title"><MailIcon size={17} /></a>}
          {p.siteWeb && <a href={p.siteWeb} target="_blank" rel="noreferrer" aria-label="Ouvrir le site" className="flex size-11 items-center justify-center rounded-card border border-border text-text hover:text-title"><ExternalLinkIcon size={17} /></a>}
          {p.adresse && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.adresse)}`} target="_blank" rel="noreferrer" aria-label="Itinéraire" className="flex size-11 items-center justify-center rounded-card border border-border text-text hover:text-title"><MapPinIcon size={17} /></a>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-text">
        Suivi par <span className="font-semibold text-text-strong">{p.commercial ? teamName(p.commercial) : "personne"}</span>
        {p.commercialId !== me.id && <AssignButton id={p.id} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <EchangeForm prospectId={p.id} statut={p.statut} session={inSession} today={parisDay()} />
          <Historique items={echanges.map((e) => ({ id: e.id, type: e.type, notes: e.notes, date: e.date.toISOString(), auteur: e.auteur ? teamName(e.auteur) : e.auteurNom, client: !e.prospectId }))} />
        </div>
        <div className="space-y-6">
          <RdvList items={p.rendezVous.map((x) => ({ id: x.id, debut: x.debut.toISOString(), lieu: x.lieu, resultat: x.resultat }))} />
          <Contacts prospectId={p.id} contacts={p.contacts.map((c) => ({ id: c.id, prenom: c.prenom, nom: c.nom, fonction: c.fonction, email: c.email, telephone: c.telephone, principal: c.principal }))} />
          <ProspectForm
            p={{
              id: p.id, societe: p.societe, siren: p.siren, siret: p.siret, dirigeant: p.dirigeant, adresse: p.adresse, siteWeb: p.siteWeb, telephone: p.telephone,
              cible: p.cible?.nom ?? null, source: p.source, statut: p.statut, motifPerte: p.motifPerte, potentielEuros: p.potentielEuros, fraisCreationEuros: p.fraisCreationEuros,
              mensuelEuros: p.mensuelEuros, commercialId: p.commercialId, relance: p.relanceAt ? parisDay(p.relanceAt) : "", isClient: !!p.clientId,
            }}
            team={team.map((u) => ({ id: u.id, name: teamName(u) }))}
            cibles={cibles.map((c) => c.nom)}
            canDelete={me.role === "ADMIN" && !p.clientId}
          />
        </div>
      </div>
    </main>
  );
}
