import Link from "next/link";
import { CalendarPlusIcon, ChevronRight, FileTextIcon, HistoryIcon, LifeBuoyIcon, LightbulbIcon, MessageCircleIcon, PencilLineIcon, UploadIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDateShort } from "@/lib/format";
import { servicesSouscrits, SERVICES, type ServiceKey } from "@/lib/services-client";
import { PRESTATIONS, PRESTATIONS_EN_AVANT, POINT } from "@/lib/prestations";
import { Art } from "../studio/art";

export const metadata = { title: "Accompagnement" };

const Ligne = ({ href, icon: Icon, titre, texte, badge }: { href: string; icon: React.ElementType; titre: string; texte: string; badge?: React.ReactNode }) => (
  <Card href={href} className="flex items-center justify-between py-3">
    <div className="flex min-w-0 items-center gap-3"><Icon size={20} strokeWidth={1.5} className="shrink-0 text-text" /><div className="min-w-0"><p className="font-medium text-title">{titre}</p><p className="truncate text-xs text-text">{texte}</p></div></div>
    <div className="flex shrink-0 items-center gap-2">{badge}<ChevronRight size={18} className="text-text" /></div>
  </Card>
);

/** Accompagnement : le conseiller, l'abonnement, les demandes, le travail réalisé et toutes les prestations (remplace l'onglet Messages, maquette V3). */
export default async function AccompagnementPage() {
  const { client } = await requireClientContext();
  const [c, conv, souscrits, subs, contrats, sites, modifs, difficultes, rdv] = await Promise.all([
    prisma.client.findUnique({ where: { id: client.id }, select: { commercial: { select: { firstName: true, lastName: true, avatarUrl: true } }, developpeur: { select: { firstName: true, lastName: true, avatarUrl: true } } } }),
    prisma.conversation.findUnique({ where: { clientId: client.id }, select: { id: true, clientReadAt: true } }),
    servicesSouscrits(client.id),
    prisma.subscription.findMany({ where: { clientId: client.id, status: "ACTIF" }, select: { id: true, label: true, offer: { select: { name: true } } } }),
    prisma.contrat.findMany({ where: { clientId: client.id, statut: "SIGNE" }, orderBy: { signeAt: "desc" }, take: 3, select: { id: true, titre: true, signeAt: true } }),
    prisma.site.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.changeRequest.count({ where: { site: { clientId: client.id }, status: { not: "TERMINEE" } } }),
    prisma.difficulte.count({ where: { clientId: client.id, statut: { not: "RESOLUE" } } }),
    prisma.rendezVous.findFirst({ where: { clientId: client.id, resultat: "PREVU", debut: { gte: new Date() } }, orderBy: { debut: "asc" }, select: { debut: true, titre: true, meetUrl: true } }),
  ]);
  const unread = conv ? await prisma.message.count({ where: { conversationId: conv.id, author: { role: { not: "CLIENT" } }, createdAt: { gt: conv.clientReadAt ?? new Date(0) } } }) : 0;
  const conseiller = c?.commercial ?? c?.developpeur ?? null;
  const nom = conseiller ? `${conseiller.firstName ?? ""} ${conseiller.lastName ?? ""}`.trim() : "";
  const initiales = conseiller ? `${conseiller.firstName?.[0] ?? ""}${conseiller.lastName?.[0] ?? ""}`.toUpperCase() || "AC" : "AC";
  const inclus = (Object.keys(SERVICES) as ServiceKey[]).filter((k) => souscrits[k]).map((k) => SERVICES[k].label);
  const abonnements = subs.map((s) => s.offer?.name ?? s.label).filter(Boolean);
  const hrefModif = sites.length === 1 ? `/sites/${sites[0].id}/modifications/nouvelle` : "/services";
  const hrefSuiviModifs = sites.length === 1 ? `/sites/${sites[0].id}/modifications` : "/services";
  const demandes = modifs + difficultes;

  return (
    <Page title={<><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2.4px] text-text"><span className="size-2 rounded-full bg-green" /> ACCO à vos côtés</span>Vous n’êtes pas seul.</>} subtitle="Un interlocuteur, une équipe et un accompagnement sur la durée.">
      <Card className="mb-3">
        <div className="flex items-center gap-4">
          <Avatar initials={initiales} src={conseiller?.avatarUrl} size={60} className="text-lg" />
          <div className="min-w-0"><p className="text-xs text-text">{nom ? "Votre conseiller dédié" : "Votre équipe ACCO"}</p><h2 className="text-lg font-bold text-title">{nom || "L’équipe ACCO"}.</h2><p className="text-sm text-text">Un interlocuteur pour vos projets digitaux.</p></div>
        </div>
        {rdv && <p className="mt-3 rounded-card border border-border bg-surface-2 px-3 py-2 text-sm text-title">Prochain rendez-vous : {fmtDateShort(rdv.debut)} à {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(rdv.debut)}{rdv.titre ? ` · ${rdv.titre}` : ""}{rdv.meetUrl ? <> · <a href={rdv.meetUrl} target="_blank" rel="noreferrer" className="underline">Google Meet</a></> : null}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button href="/accompagnement/rendez-vous"><CalendarPlusIcon size={16} /> Prendre rendez-vous</Button>
          <Button href="/messages" variant="secondary" className="relative"><MessageCircleIcon size={16} /> Nous écrire{unread ? <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1.5 text-[11px] font-bold text-bg">{unread > 9 ? "9+" : unread}</span> : null}</Button>
        </div>
      </Card>

      <Card className="mb-6">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-text"><span className="size-2 rounded-full bg-green" /> Votre accompagnement</p>
        <h2 className="mt-2 text-lg font-bold text-title">{abonnements[0] ?? (inclus.length ? "Votre abonnement" : "Pas encore d’abonnement actif")}.</h2>
        <p className="text-sm text-text">{inclus.length ? `${inclus.join(" · ")}${inclus.includes("Site") ? " · suivi technique" : ""}` : "Dès qu’un service est actif, il apparaît ici."}</p>
        {abonnements.length > 1 && <div className="mt-2 flex flex-wrap gap-1.5">{abonnements.map((a, i) => <Badge key={i} tone="green">{a}</Badge>)}</div>}
        {contrats.length > 0 && <ul className="mt-3 divide-y divide-border text-sm">{contrats.map((k) => <li key={k.id} className="flex items-center justify-between py-1.5"><span className="truncate text-title">{k.titre}</span><span className="shrink-0 text-xs text-text">{k.signeAt ? `signé le ${fmtDateShort(k.signeAt)}` : "signé"}</span></li>)}</ul>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-title">
          <Link href="/services" className="underline underline-offset-4">Voir mes services ↗</Link>
          <Link href="/compte/documents" className="underline underline-offset-4">Contrats et documents ↗</Link>
        </div>
      </Card>

      <h2 className="mb-3 text-xl font-bold text-title">Mes demandes.</h2>
      <div className="mb-6 grid gap-2">
        {sites.length > 0 && <Ligne href={hrefModif} icon={PencilLineIcon} titre="Modifier mon site" texte="Transmettez votre besoin, nous nous occupons du reste." />}
        <Ligne href={modifs ? hrefSuiviModifs : "/difficultes"} icon={LifeBuoyIcon} titre="Mes demandes en cours" texte={demandes ? `${modifs ? `${modifs} modification${modifs > 1 ? "s" : ""}` : ""}${modifs && difficultes ? " · " : ""}${difficultes ? `${difficultes} difficulté${difficultes > 1 ? "s" : ""}` : ""} à suivre` : "Aucune demande en cours. Un souci ? Signalez-le ici."} badge={demandes ? <Badge tone="yellow">{demandes}</Badge> : undefined} />
        <Ligne href="/messages" icon={MessageCircleIcon} titre="Mes échanges" texte="Le fil de vos conversations avec l’équipe." badge={unread ? <Badge tone="pink">{unread} nouveau{unread > 1 ? "x" : ""}</Badge> : undefined} />
        <Ligne href="/compte/documents" icon={UploadIcon} titre="Transmettre un document" texte="Envoyez une ressource à votre conseiller." />
      </div>

      <h2 className="mb-3 text-xl font-bold text-title">Notre travail pour vous.</h2>
      <div className="mb-6 grid gap-2">
        <Ligne href="/historique" icon={HistoryIcon} titre="Interventions ACCO" texte="Tout ce que nous avons fait pour vous, mois par mois." />
        <Ligne href="/conseils" icon={LightbulbIcon} titre="Nos conseils" texte="Vos prochaines actions pour faire venir des clients." />
      </div>

      <div className="mb-3 flex items-end justify-between gap-3"><h2 className="text-xl font-bold text-title">Nos services.</h2><Link href="/accompagnement/services" className="text-sm text-text underline-offset-4 hover:underline">Tous nos services ↗</Link></div>
      <div className="grid gap-3">
        {PRESTATIONS_EN_AVANT.map((k) => { const p = PRESTATIONS[k]; return (
          <Link key={k} href={`/accompagnement/services#${k}`} className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 transition-colors hover:border-text">
            <Art kind={p.art} label="ACCO / Services" className="h-28 w-[36%] shrink-0" />
            <div className="min-w-0"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-text"><span className={`size-2 rounded-full ${POINT[p.couleur]}`} /> Aller plus loin</p><h3 className="mt-1 text-lg font-bold text-title">{p.titre}.</h3><p className="text-sm text-text">{p.texte}</p><p className="mt-2 text-sm font-semibold text-title underline underline-offset-4">Découvrir la prestation ↗</p></div>
          </Link>
        ); })}
      </div>
      <Button href="/accompagnement/services" variant="secondary" className="mt-3 w-full"><FileTextIcon size={16} /> Explorer tous les services</Button>
    </Page>
  );
}
