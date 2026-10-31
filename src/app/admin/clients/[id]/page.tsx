import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS, PROJECT_STEPS, FORMULE, CHANGE_STATUS } from "@/lib/labels";
import { fmtDate, fmtPrice } from "@/lib/format";
import { ClientForms } from "./forms";
import { OffresClient } from "./offres";
import { SuiviForm, CompteRenduForm } from "./suivi-forms";
import { activePromo, MODULE_LABEL } from "@/lib/offers";
import { sendInvitation } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { AircallBloc, AircallTitre, GmailBloc, isAircallMeta, isGmailMeta } from "@/components/crm/echange-detail";
import { ECHANGE, contactName, fmtDayTime, parisDay, teamName, todayBounds } from "@/lib/crm";
import { MODULES } from "@/lib/roles";
import { syncProspect } from "@/lib/crm-sync";
import { appareil } from "@/lib/login-log";
import {
  ChevronRight, CreditCardIcon, ExternalLinkIcon, FileTextIcon, FolderOpen, GlobeIcon, HistoryIcon, KeyRoundIcon, MapPinIcon, MessageSquareIcon,
  PencilRulerIcon, PhoneIcon, StarIcon, UserIcon, UsersIcon,
} from "lucide-react";

/**
 * Fiche client centralisée (module Suivi) : informations et contacts, contrat et offre, technique et web,
 * historique des échanges (Aircall, emails, comptes rendus), demandes de modification, journal des connexions.
 */
export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireTeam();
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sites: { orderBy: { createdAt: "asc" }, include: { changeRequests: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, title: true, status: true, createdAt: true, urgency: true } } } },
      memberships: { include: { user: true } },
      subscriptions: { orderBy: { startedAt: "desc" }, include: { site: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      commercial: { select: { id: true, firstName: true, email: true } },
      developpeur: { select: { id: true, firstName: true, email: true } },
      crmProspect: { select: { id: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }] } } },
      loginLogs: { orderBy: { at: "desc" }, take: 15, include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      _count: { select: { orders: true, documentRequests: { where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" } } } },
    },
  });
  if (!client) notFound();
  // Appels Aircall et emails : via la fiche prospect liée (au plus une fois toutes les 10 minutes).
  if (client.crmProspect) await syncProspect(client.crmProspect.id).catch(() => null);

  const pendingDocs = client._count.documentRequests;
  const [offers, orders, echanges, equipe] = await Promise.all([
    prisma.offer.findMany({ where: { OR: [{ isArchived: false }, { subscriptions: { some: { clientId: client.id, status: "ACTIF" } } }] }, orderBy: { order: "asc" }, include: { promotions: true } }),
    prisma.order.findMany({ where: { clientId: client.id, status: "A_TRAITER" }, select: { offerId: true } }),
    prisma.echange.findMany({
      where: { OR: [{ clientId: client.id }, ...(client.crmProspect ? [{ prospectId: client.crmProspect.id }] : [])] },
      orderBy: { date: "desc" }, take: 60, include: { auteur: { select: { firstName: true, email: true } } },
    }),
    prisma.user.findMany({ where: { role: { in: MODULES.suivi } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, role: true } }),
  ]);
  const commandes = new Set(orders.map((o) => o.offerId));
  const actives = client.subscriptions.filter((s) => s.status === "ACTIF");
  const mensuel = actives.filter((s) => s.billing === "MENSUEL").reduce((a, s) => a + s.priceCents, 0);
  const ponctuel = actives.filter((s) => s.billing !== "MENSUEL").reduce((a, s) => a + s.priceCents, 0);
  const toActive = (s: (typeof actives)[number]) => ({
    id: s.id, label: s.label, price: `${fmtPrice(s.priceCents)}${s.billing === "MENSUEL" ? " / mois" : ""}`, since: fmtDate(s.startedAt),
    site: s.site?.name ?? null, endsAt: s.commitmentEndsAt ? fmtDate(s.commitmentEndsAt) : null, quota: s.monthlyQuota,
  });
  const modifications = client.sites.flatMap((s) => s.changeRequests.map((r) => ({ ...r, siteName: s.name, siteId: s.id }))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
  const contacts = client.crmProspect?.contacts ?? [];
  const peutAttribuer = me.role === "ADMIN" || me.role === "COMMERCIAL";
  const dernierContact = echanges.find((e) => e.type !== "NOTE")?.date ?? null;
  const joursSansContact = dernierContact ? Math.floor((todayBounds().end.getTime() - dernierContact.getTime()) / 86400_000) : null;

  return (
    <AdminPage
      title={<span className="flex items-center gap-2">{client.reference && <StarIcon size={18} className="shrink-0 fill-yellow text-yellow" aria-label="Client référence" />}{client.name}</span>}
      back={{ href: "/admin/clients", label: "Clients" }}
      action={<div className="flex items-center gap-2">{client.formule && <Badge tone={FORMULE[client.formule].tone}>{FORMULE[client.formule].label}</Badge>}</div>}
    >
      <p className="-mt-3 text-sm text-text">
        Suivi par <span className="font-semibold text-text-strong">{client.commercial ? teamName(client.commercial) : "personne"}</span>
        {client.developpeur && <> · développé par <span className="font-semibold text-text-strong">{teamName(client.developpeur)}</span></>}
        {joursSansContact !== null && <> · dernier contact il y a <span className={joursSansContact > 60 ? "font-semibold text-pink" : "text-text-strong"}>{joursSansContact} j</span></>}
        {joursSansContact === null && <> · <span className="text-pink">aucun contact noté</span></>}
      </p>

      {/* 1. Informations générales et contacts */}
      <SectionTitle icon={UsersIcon}>Informations et contacts</SectionTitle>
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {client.phone && <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-title hover:underline"><PhoneIcon size={14} className="text-text" aria-hidden /> {client.phone}</a>}
          {client.email && <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-title hover:underline"><MessageSquareIcon size={14} className="text-text" aria-hidden /> {client.email}</a>}
          {client.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-text-strong hover:underline"><MapPinIcon size={14} className="text-text" aria-hidden /> {client.address}</a>}
          {client.siren && <span className="text-text">SIREN {client.siren}</span>}
        </div>
        {contacts.length > 0 && (
          <ul className="divide-y divide-border rounded-card border border-border">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-title">{contactName(c) ?? "Contact"}{c.principal && <StarIcon size={12} className="shrink-0 fill-yellow text-yellow" aria-label="Contact principal" />}</p>
                  <p className="truncate text-xs text-text">{[c.fonction, c.telephone, c.email].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {c.telephone && <a href={`tel:${c.telephone.replace(/\s/g, "")}`} className="text-xs text-text hover:text-title">Appeler</a>}
                {c.email && <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}`} target="_blank" rel="noreferrer" className="text-xs text-text hover:text-title">Écrire</a>}
              </li>
            ))}
          </ul>
        )}
        {client.crmProspect ? <Link href={`/crm/prospects/${client.crmProspect.id}`} className="inline-block text-xs text-text hover:text-title">Gérer les contacts sur la fiche prospect →</Link> : <p className="text-xs text-muted">Pas de fiche prospect liée : les contacts se gèrent dans « Accès du client » ci-dessous.</p>}
      </Card>

      {/* 2. Contrat et offre */}
      <SectionTitle icon={CreditCardIcon}>Contrat et offre</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-text">Formule</p><p className="mt-1 font-semibold text-title">{client.formule ? FORMULE[client.formule].label : "—"}</p></Card>
        <Card><p className="text-xs text-text">Engagement</p><p className="mt-1 text-sm font-semibold text-title">{client.engagementDebut ? fmtDate(client.engagementDebut) : "—"} → {client.engagementFin ? fmtDate(client.engagementFin) : "—"}</p></Card>
        <Card><p className="text-xs text-text">Suivi par</p><p className="mt-1 font-semibold text-title">{client.commercial ? teamName(client.commercial) : "—"}</p></Card>
        <Card><p className="text-xs text-text">Développeur</p><p className="mt-1 font-semibold text-title">{client.developpeur ? teamName(client.developpeur) : "—"}</p></Card>
      </div>
      <div className="mt-2 grid"><SuiviForm client={{ id: client.id, formule: client.formule, engagementDebut: client.engagementDebut ? parisDay(client.engagementDebut) : "", engagementFin: client.engagementFin ? parisDay(client.engagementFin) : "", gmbUrl: client.gmbUrl, commercialId: client.commercialId, developpeurId: client.developpeurId, reference: client.reference }} commerciaux={equipe.filter((u) => MODULES.prospection.includes(u.role)).map((u) => ({ id: u.id, name: teamName(u) }))} devs={equipe.filter((u) => u.role !== "COMMERCIAL").map((u) => ({ id: u.id, name: teamName(u) }))} peutAttribuer={peutAttribuer} /></div>
      <div className="mt-3">
        <OffresClient
          clientId={client.id}
          totaux={{ actives: actives.length, mensuel: fmtPrice(mensuel), ponctuel: fmtPrice(ponctuel) }}
          base={actives.filter((s) => !s.offerId).map(toActive)}
          offres={offers.map((o) => ({
            id: o.id, name: o.name, benefit: o.benefit, mensuel: o.billing === "MENSUEL",
            price: `${fmtPrice(activePromo(o)?.price ?? o.priceCents)}${o.billing === "MENSUEL" ? " / mois" : ""}${o.setupCents ? ` + ${fmtPrice(o.setupCents)} à l’installation` : ""}`,
            module: o.module !== "NONE" ? MODULE_LABEL[o.module] : null,
            actives: actives.filter((s) => s.offerId === o.id).map(toActive),
            commandee: commandes.has(o.id),
          }))}
          resiliees={client.subscriptions.filter((s) => s.status === "RESILIE").map((s) => ({ id: s.id, label: s.label, quand: s.cancelledAt ? `résiliée le ${fmtDate(s.cancelledAt)}` : "résiliée" }))}
          sites={client.sites.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>

      {/* 3. Technique et web */}
      <SectionTitle icon={GlobeIcon}>Technique et web</SectionTitle>
      <div className="grid gap-2">
        {client.sites.map((s) => (
          <Card key={s.id} href={`/admin/sites/${s.id}`} className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <p className="font-semibold text-title">{s.name}</p>
              <p className="truncate text-xs text-text">{s.status === "EN_CREATION" ? `Étape : ${PROJECT_STEPS.find((p) => p.key === s.projectStep)?.label}${s.previewUrl ? ` · aperçu : ${s.previewUrl}` : ""}` : s.url ?? "—"}</p>
            </div>
            <Badge tone={SITE_STATUS[s.status].tone}>{SITE_STATUS[s.status].label}</Badge>
          </Card>
        ))}
        {client.sites.length === 0 && <p className="text-sm text-text">Aucun site.</p>}
        <div className="flex flex-wrap gap-2 text-sm">
          {client.sites.filter((s) => s.previewUrl && s.status === "EN_CREATION").map((s) => <a key={s.id} href={s.previewUrl!} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-text-strong hover:border-text"><ExternalLinkIcon size={12} /> Prévisualisation {s.name}</a>)}
          {client.gmbUrl ? <a href={client.gmbUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-text-strong hover:border-text"><MapPinIcon size={12} /> Fiche Google</a> : <span className="rounded-full border border-border px-3 py-1 text-muted">Fiche Google : non renseignée</span>}
        </div>
      </div>

      {/* 4. Communication et historique */}
      <SectionTitle icon={HistoryIcon}>Historique des échanges <span className="text-sm font-normal text-text">{echanges.length}</span></SectionTitle>
      <CompteRenduForm clientId={client.id} today={parisDay()} />
      {echanges.length === 0 ? <p className="mt-3 text-sm text-text">Aucun échange noté. Les appels Aircall et les emails remontent automatiquement quand la fiche prospect liée a un numéro ou une adresse email.</p> : (
        <ol className="mt-4 space-y-3 border-l border-border pl-5">
          {echanges.map((e) => {
            const call = isAircallMeta(e.meta) ? e.meta : null, mail = isGmailMeta(e.meta) ? e.meta : null;
            return (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-bg bg-blue" />
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-text">
                  <span className="font-semibold text-text-strong">{call && e.origine === "aircall" ? "Appel Aircall" : mail ? (mail.direction === "recu" ? "Mail reçu" : "Mail envoyé") : ECHANGE[e.type].short}</span>
                  {call && <AircallTitre m={call} />}
                  <span>{fmtDayTime(e.date)}</span>
                  {(e.auteur || e.auteurNom) && !(call && e.origine === "aircall") && <span>· {e.auteur ? teamName(e.auteur) : e.auteurNom}</span>}
                </div>
                {e.notes && e.origine !== "aircall" && !mail && <p className="mt-1 text-sm whitespace-pre-line text-text-strong">{e.notes.length > 600 ? e.notes.slice(0, 600) + "…" : e.notes}</p>}
                {call && <AircallBloc echangeId={e.id} m={call} />}
                {mail && <GmailBloc m={mail} />}
              </li>
            );
          })}
        </ol>
      )}

      {/* 5. Demandes de modification */}
      <SectionTitle icon={PencilRulerIcon} action={<Link href="/admin/modifications" className="text-sm text-text hover:text-title">Tableau des modifications</Link>}>Demandes de modification</SectionTitle>
      {modifications.length === 0 ? <p className="text-sm text-text">Aucune demande de modification.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {modifications.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-title">{r.title}</p>
                <p className="truncate text-xs text-text">{r.siteName} · {fmtDate(r.createdAt)}{r.urgency === "URGENTE" ? " · urgent" : ""}</p>
              </div>
              <Badge tone={CHANGE_STATUS[r.status].tone}>{CHANGE_STATUS[r.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}

      {/* 6. Accès et connexions */}
      <SectionTitle icon={UserIcon}>Accès du client</SectionTitle>
      <div className="grid gap-2">
        {client.memberships.map((m) => (
          <Card key={m.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-title">{[m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email}</p>
              <p className="text-xs text-text">{m.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={m.role === "OWNER" ? "blue" : "neutral"}>{m.role === "OWNER" ? "Gérant" : "Membre"}</Badge>
              <form action={sendInvitation.bind(null, client.id, m.userId)}><SubmitButton variant="secondary" size="sm" pendingLabel="Envoi…">Envoyer l’invitation</SubmitButton></form>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle icon={KeyRoundIcon}>Journal des connexions</SectionTitle>
      {client.loginLogs.length === 0 ? <p className="text-sm text-text">Aucune connexion enregistrée pour l’instant (le journal démarre à la mise en place de cette fiche).</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
          {client.loginLogs.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 truncate text-title">{[l.user.firstName, l.user.lastName].filter(Boolean).join(" ") || l.user.email}</span>
              <span className="text-xs text-text">{appareil(l.userAgent)}</span>
              <span className="text-xs text-text tabular-nums">{fmtDayTime(l.at)}</span>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle icon={FileTextIcon}>Documents</SectionTitle>
      <Card href={`/admin/clients/${client.id}/documents`} className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3"><FolderOpen size={20} strokeWidth={1.5} className="text-text" /><div><p className="font-medium text-title">Espace documents</p><p className="text-xs text-text">{client.documents.length} document{client.documents.length > 1 ? "s" : ""}{pendingDocs > 0 ? ` · ${pendingDocs} attendu${pendingDocs > 1 ? "s" : ""} du client` : ""}</p></div></div>
        <div className="flex items-center gap-2">{pendingDocs > 0 && <Badge tone="yellow">{pendingDocs}</Badge>}<ChevronRight size={18} className="text-text" /></div>
      </Card>
      <div className="mt-3"><Card href={`/admin/messages/${client.id}`} className="flex items-center gap-2 py-3 text-sm font-medium text-title"><MessageSquareIcon size={16} strokeWidth={1.75} className="text-text" aria-hidden /> Voir les messages de l’espace client</Card></div>

      <ClientForms client={{ id: client.id, name: client.name, address: client.address, phone: client.phone, email: client.email, siren: client.siren }} sites={client.sites.map((s) => ({ id: s.id, name: s.name }))} />
    </AdminPage>
  );
}
