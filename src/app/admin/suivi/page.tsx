import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { estExterne } from "@/lib/permissions";
import { whereClientsPour, whereSitesPour } from "@/lib/perimetre";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoClient } from "@/components/ui/logo-client";
import { addDays, fmtDate, daysUntil } from "@/lib/format";
import { fmtDayTime, teamName, todayBounds } from "@/lib/crm";
import { PROJECT_STEPS } from "@/lib/labels";
import { clientsAvecRdvAVenir, derniersContacts, JOURS_SANS_CONTACT } from "@/lib/alertes";
import { etatProduction } from "@/lib/production";
import { cn } from "@/lib/cn";
import { CalendarClockIcon, CircleCheckIcon, FactoryIcon, FileTextIcon, GiftIcon, HourglassIcon, InboxIcon, ListChecksIcon, UserXIcon } from "lucide-react";

export const metadata = { title: "Suivi client" };

/**
 * Tableau d'accueil commercial (2.3) : compteurs + listes concrètes + liens directs. Commun à tous les commerciaux,
 * limité par défaut à « ma responsabilité » avec accès à tout ; chaque élément pointe vers l'objet réel.
 */
export default async function SuiviPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const me = await requireTeam();
  const sp = await searchParams;
  const externe = estExterne(me);
  const moi = sp.vue !== "tous" && !externe;
  const whereClient = moi ? { OR: [{ commercialId: me.id }, { developpeurId: me.id }, { sites: { some: { developpeurId: me.id } } }] } : whereClientsPour(me);
  const now = new Date();
  const in90 = addDays(90);
  const [sites, rdvAPlanifier, clients, commandes, demandes, parrainages, docs, taches, echeances] = await Promise.all([
    prisma.site.findMany({ where: { status: "EN_CREATION", ...whereSitesPour(me), ...(moi ? { client: whereClient } : {}) }, orderBy: [{ etapeAt: "asc" }], select: { id: true, name: true, projectStep: true, version: true, deadlineV1: true, deadlineV2: true, deadlineLivraison: true, client: { select: { id: true, name: true, logoMiniPath: true, commercial: { select: { firstName: true, email: true } } } }, developpeur: { select: { firstName: true, email: true } } } }),
    prisma.tacheClient.findMany({ where: { statut: "A_FAIRE", type: "RDV_A_PLANIFIER", client: whereClient, ...(moi ? { OR: [{ responsableId: me.id }, { responsableId: null }] } : {}) }, orderBy: { createdAt: "desc" }, take: 20, include: { client: { select: { id: true, name: true, logoMiniPath: true } }, site: { select: { name: true } } } }),
    prisma.client.findMany({ where: { archivedAt: null, ...whereClient }, select: { id: true, name: true, logoMiniPath: true, createdAt: true, commercial: { select: { firstName: true, email: true } } } }),
    prisma.order.findMany({ where: { status: "A_TRAITER", client: whereClient }, orderBy: { createdAt: "desc" }, take: 20, include: { client: { select: { id: true, name: true, logoMiniPath: true } }, offer: { select: { name: true } }, site: { select: { name: true } } } }),
    prisma.changeRequest.findMany({ where: { status: { in: ["RECUE", "A_VALIDER"] }, site: { client: whereClient, ...whereSitesPour(me) } }, orderBy: { createdAt: "desc" }, take: 20, include: { site: { select: { id: true, name: true, client: { select: { id: true, name: true, logoMiniPath: true } } } } } }),
    externe ? [] : prisma.referral.findMany({ where: { status: { in: ["ENVOYEE", "CONTACTEE"] }, referrer: whereClient }, orderBy: { createdAt: "desc" }, take: 20, include: { referrer: { select: { id: true, name: true, logoMiniPath: true } }, referred: { select: { id: true, name: true } } } }),
    prisma.documentRequest.findMany({ where: { status: "EN_ATTENTE", direction: "VERS_CLIENT", client: whereClient }, orderBy: { createdAt: "asc" }, take: 30, include: { client: { select: { id: true, name: true, logoMiniPath: true } }, site: { select: { name: true } }, requester: { select: { firstName: true, email: true } } } }),
    prisma.tacheClient.findMany({ where: { statut: "A_FAIRE", type: { not: "RDV_A_PLANIFIER" }, client: whereClient, ...(moi ? { responsableId: me.id } : {}) }, orderBy: [{ echeance: { sort: "asc", nulls: "last" } }], take: 30, include: { client: { select: { id: true, name: true, logoMiniPath: true } }, responsable: { select: { firstName: true, email: true } } } }),
    externe ? [] : prisma.contrat.findMany({ where: { statut: "SIGNE", finEngagement: { gte: now, lte: in90 }, client: whereClient }, orderBy: { finEngagement: "asc" }, include: { client: { select: { id: true, name: true, logoMiniPath: true } } } }),
  ]);
  const etats = await Promise.all(sites.map((s) => etatProduction(s.id)));
  const [contacts, rdvs] = await Promise.all([derniersContacts(clients.map((c) => c.id)), clientsAvecRdvAVenir(clients.map((c) => c.id))]);
  const { end } = todayBounds();
  const sansContact = clients.map((c) => ({ c, j: Math.floor((end.getTime() - (contacts.get(c.id) ?? c.createdAt).getTime()) / 86400_000), jamais: !contacts.get(c.id) })).filter((x) => x.j >= JOURS_SANS_CONTACT && !rdvs.has(x.c.id)).sort((a, b) => b.j - a.j);
  const retard = taches.filter((t) => t.echeance && t.echeance < now).length;
  const compteurs = [
    { n: sites.length, l: "sites en création", href: "/admin/production" }, { n: rdvAPlanifier.length, l: "RDV à planifier", href: "/admin/taches?type=RDV_A_PLANIFIER" }, { n: sansContact.length, l: `sans échange depuis ${JOURS_SANS_CONTACT} j`, href: "/admin/clients?alerte=60j" },
    { n: commandes.length + demandes.length, l: "commandes et demandes", href: "/admin/clients?alerte=demandes" }, { n: docs.length, l: "documents attendus", href: "/admin/clients?alerte=docs" }, { n: taches.length, l: `tâches${retard ? ` (${retard} en retard)` : ""}`, href: "/admin/taches" },
  ];
  const C = ({ c, children, href }: { c: { id: string; name: string; logoMiniPath: string | null }; children: React.ReactNode; href?: string }) => (
    <Card href={href ?? `/admin/clients/${c.id}`} className="flex items-center gap-3 py-2.5"><LogoClient id={c.id} name={c.name} logo={c.logoMiniPath} size={32} /><div className="min-w-0 flex-1">{children}</div></Card>
  );
  /** Ordre fixé par la Direction ; les sections vides passent sous celles qui ont des éléments, sans changer leur ordre relatif. */
  const sections = [
    { key: "sites", n: sites.length, el: (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={FactoryIcon} action={<Link href="/admin/production" className="text-sm text-text hover:text-title">Kanban</Link>}>Sites en cours de création ({sites.length})</SectionTitle>
          <div className="grid gap-2">{sites.map((s, i) => { const step = PROJECT_STEPS.find((p) => p.key === s.projectStep)!; const dl = s[step.deadline]; const e = etats[i]; return (
            <C key={s.id} c={s.client} href={`/admin/sites/${s.id}`}><p className="truncate text-sm font-semibold text-title">{s.name} <span className="font-normal text-text">· {step.label} · V{s.version}</span></p><p className="truncate text-xs text-text">{s.client.name} · réf. {s.client.commercial ? teamName(s.client.commercial) : "—"} · dev {s.developpeur ? teamName(s.developpeur) : "—"}{dl ? ` · ${step.deadline === "deadlineV1" ? "V1" : step.deadline === "deadlineV2" ? "V2" : "livraison"} le ${fmtDate(dl)}${dl < now ? " (retard)" : ""}` : ""}</p>{e.blocages.length > 0 && <p className="truncate text-xs text-pink">{e.blocages[0]}</p>}{e.actions.length > 0 && <p className="truncate text-xs text-blue">→ {e.actions[0]}</p>}</C>
          ); })}{sites.length === 0 && <p className="text-sm text-text">Aucun site en création.</p>}</div>
      </section>
    ) },
    { key: "rdv", n: rdvAPlanifier.length, el: (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={CalendarClockIcon} action={<Link href="/admin/taches?type=RDV_A_PLANIFIER" className="text-sm text-text hover:text-title">Toutes</Link>}>Rendez-vous à planifier ({rdvAPlanifier.length})</SectionTitle>
          <div className="grid gap-2">{rdvAPlanifier.map((t) => <C key={t.id} c={t.client} href={`/admin/clients/${t.client.id}?onglet=taches`}><p className="truncate text-sm font-semibold text-title">{t.titre}</p><p className="truncate text-xs text-text">{t.client.name}{t.site ? ` · ${t.site.name}` : ""} · {fmtDayTime(t.createdAt)}{t.source ? ` · ${t.source}` : ""} · fixer le RDV depuis la fiche</p></C>)}{rdvAPlanifier.length === 0 && <p className="text-sm text-text">Rien à planifier : maquettes et versions prêtes apparaissent ici.</p>}</div>
      </section>
    ) },
    { key: "taches", n: taches.length, el: (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={ListChecksIcon} action={<Link href="/admin/taches" className="text-sm whitespace-nowrap text-text hover:text-title">Toutes</Link>}>Tâches et relances prioritaires ({taches.length})</SectionTitle>
          <div className="grid gap-2">{taches.slice(0, 12).map((t) => <C key={t.id} c={t.client} href={`/admin/clients/${t.client.id}?onglet=taches`}><p className="truncate text-sm font-semibold text-title">{t.titre}</p><p className={cn("text-xs", t.echeance && t.echeance < now ? "text-pink" : "text-text")}>{t.client.name} · {t.echeance ? `${t.echeance < now ? "en retard · " : ""}${fmtDate(t.echeance)}` : "sans échéance"} · {t.responsable ? teamName(t.responsable) : "sans responsable"}</p></C>)}{taches.length === 0 && <p className="text-sm text-text">Aucune tâche en attente.</p>}</div>
      </section>
    ) },
    { key: "commandes", n: commandes.length + demandes.length, el: (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={InboxIcon}>Commandes et demandes à traiter ({commandes.length + demandes.length})</SectionTitle>
          <div className="grid gap-2">{commandes.map((o) => <C key={o.id} c={o.client} href="/admin/commandes"><p className="truncate text-sm font-semibold text-title">Commande : {o.offer.name}{o.site ? ` pour ${o.site.name}` : ""}</p><p className="text-xs text-text">{o.client.name} · {fmtDayTime(o.createdAt)}</p></C>)}{demandes.map((d) => <C key={d.id} c={d.site.client} href="/admin/modifications"><p className="truncate text-sm font-semibold text-title">Modification : {d.title}</p><p className="text-xs text-text">{d.site.client.name} · {d.site.name} · {fmtDayTime(d.createdAt)}</p></C>)}{commandes.length + demandes.length === 0 && <p className="text-sm text-text">Rien à traiter.</p>}</div>
      </section>
    ) },
    { key: "parrainages", n: parrainages.length, el: externe ? null : (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={GiftIcon} action={<Link href="/admin/recommandations" className="text-sm text-text hover:text-title">Toutes</Link>}>Parrainages à qualifier ({parrainages.length})</SectionTitle>
          <div className="grid gap-2">{parrainages.map((r) => <C key={r.id} c={r.referrer} href="/admin/recommandations"><p className="truncate text-sm font-semibold text-title">{r.contactName ?? "Contact"} <Badge tone={r.status === "ENVOYEE" ? "blue" : "yellow"}>{r.status === "ENVOYEE" ? "à qualifier" : "contacté"}</Badge></p><p className="text-xs text-text">parrain : {r.referrer.name}{r.referred ? ` · prospect : ${r.referred.name}` : ""} · {fmtDate(r.createdAt)}</p></C>)}{parrainages.length === 0 && <p className="text-sm text-text">Aucune recommandation en attente.</p>}</div>
      </section>
    ) },
    { key: "docs", n: docs.length, el: (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={FileTextIcon}>Documents attendus du client ({docs.length})</SectionTitle>
          <div className="grid gap-2">{docs.map((d) => <C key={d.id} c={d.client} href={`/admin/clients/${d.client.id}/documents`}><p className="truncate text-sm font-semibold text-title">{d.kind.toLowerCase()}{d.site ? ` · ${d.site.name}` : ""}{d.message ? ` · ${d.message}` : ""}</p><p className="text-xs text-text">{d.client.name} · demandé le {fmtDate(d.createdAt)}{d.requester ? ` par ${teamName(d.requester)}` : ""} · non reçu</p></C>)}{docs.length === 0 && <p className="text-sm text-text">Rien d’attendu.</p>}</div>
      </section>
    ) },
    { key: "sansContact", n: sansContact.length, el: (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={UserXIcon} action={<Link href="/admin/clients?alerte=60j" className="text-sm whitespace-nowrap text-text hover:text-title">Voir</Link>}>Sans échange depuis {JOURS_SANS_CONTACT} jours ({sansContact.length})</SectionTitle>
          <div className="grid gap-2">{sansContact.slice(0, 12).map(({ c, j, jamais }) => <C key={c.id} c={c}><p className="truncate text-sm font-semibold text-title">{c.name}</p><p className="text-xs text-pink">{jamais ? `aucun échange tracé · client depuis ${j} j` : `dernier échange il y a ${j} j`}{c.commercial ? ` · ${teamName(c.commercial)}` : ""}</p></C>)}{sansContact.length === 0 && <p className="text-sm text-text">Tous les clients ont eu un échange récent ou un RDV prévu.</p>}</div>
      </section>
    ) },
    { key: "echeances", n: echeances.length, el: externe ? null : (
      <section className="rounded-card border border-border bg-surface p-5">
          <SectionTitle icon={HourglassIcon}>Échéances contractuelles sous 90 jours ({echeances.length})</SectionTitle>
          <div className="grid gap-2">{echeances.map((c) => <C key={c.id} c={c.client!} href={`/admin/contrats/${c.id}`}><p className="truncate text-sm font-semibold text-title">{c.client!.name} · {c.reference}</p><p className="text-xs text-text">fin le {fmtDate(c.finEngagement!)} · préavis {c.preavisJours} j</p><Badge tone={daysUntil(c.finEngagement!) <= 30 ? "pink" : "yellow"}>dans {daysUntil(c.finEngagement!)} j</Badge></C>)}{echeances.length === 0 && <p className="text-sm text-text">Aucune échéance sous 90 jours.</p>}</div>
      </section>
    ) },
  ].filter((s) => s.el);
  const ordonnees = [...sections.filter((s) => s.n > 0), ...sections.filter((s) => s.n === 0)];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl">Suivi client</h1><p className="mt-1 text-sm text-text">{clients.length} client{clients.length > 1 ? "s" : ""} {moi ? "dans ma responsabilité" : "au total"} · chaque bloc ouvre le dossier concerné.</p></div>
        {!externe && <div className="flex rounded-full border border-border p-0.5 text-sm"><Link href="/admin/suivi" className={cn("rounded-full px-3 py-1.5", moi ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>Ma responsabilité</Link><Link href="/admin/suivi?vue=tous" className={cn("rounded-full px-3 py-1.5", !moi ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>Tous les clients</Link></div>}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{compteurs.map((t) => <Card key={t.l} href={t.href} className={cn(t.n > 0 && "border-pink/40")}><p className={cn("font-title text-3xl font-extrabold", t.n > 0 ? "text-title" : "text-muted")}>{t.n}</p><p className="mt-1 text-xs text-text">{t.l}</p></Card>)}</div>

      <div className="mt-8 grid gap-5">
        {ordonnees.map((s) => <div key={s.key}>{s.el}</div>)}
      </div>
      <p className="mt-6 text-xs text-muted"><CircleCheckIcon size={12} className="mr-1 inline" aria-hidden />Les chiffres viennent des objets réels (sites, tâches, demandes, contrats), jamais de valeurs fictives.</p>
    </main>
  );
}
