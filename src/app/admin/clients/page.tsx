import Link from "next/link";
import { Plus, SearchIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { AdminPage } from "@/components/admin/page";
import { MultiSelect } from "@/components/ui/multi-select";
import { multi } from "@/lib/filtres";
import { Button } from "@/components/ui/button";
import { FORMULE, SITE_STATUS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { clientsAvecRdvAVenir, derniersContacts, JOURS_SANS_CONTACT } from "@/lib/alertes";
import { MODULES } from "@/lib/roles";
import { matchRecherche, teamName, todayBounds } from "@/lib/crm";
import { fmtDate, fmtPrice } from "@/lib/format";
import { whereClientsPour } from "@/lib/perimetre";
import { can, estExterne } from "@/lib/permissions";
import { GrilleClients, type Ligne, type Vue } from "./grille";

export const metadata = { title: "Clients" };
type SP = { vue?: string; q?: string; c?: string; f?: string; site?: string; dev?: string; secteur?: string; alerte?: string; tri?: string; page?: string };
const PAGE = 50;

/**
 * Tableau central des clients (3.2) : vignette logo, recherche, filtres combinables, vues enregistrées, tri, pagination,
 * sélection et actions groupées. « Mes clients » = portefeuille (référent, développeur) ; « Tous » visible par toute l'équipe interne.
 */
export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireTeam();
  const sp = await searchParams;
  const vue = sp.vue === "tous" ? "tous" : sp.vue === "archives" ? "archives" : sp.vue === "me" ? "me" : me.role === "ADMIN" ? "tous" : "me";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  // Filtres à choix multiples (valeurs jointes par des virgules dans l'URL) : vide = tout.
  const fc = multi(sp.c), fdev = multi(sp.dev), ff = multi(sp.f).filter((x) => x in FORMULE) as (keyof typeof FORMULE)[], fsite = multi(sp.site), falerte = multi(sp.alerte);
  const [clients, equipe, vues] = await Promise.all([
    prisma.client.findMany({
      where: { AND: [whereClientsPour(me), vue === "archives" ? { archivedAt: { not: null } } : { archivedAt: null }, vue === "me" ? { OR: [{ commercialId: me.id }, { developpeurId: me.id }, { sites: { some: { developpeurId: me.id } } }] } : {}, fc.length ? { commercialId: { in: fc } } : {}, ff.length ? { formule: { in: ff } } : {}, fdev.length ? { OR: fdev.flatMap((d) => [{ developpeurId: d }, { sites: { some: { developpeurId: d } } }]) } : {}, sp.secteur ? { secteur: { contains: sp.secteur, mode: "insensitive" } } : {}, fsite.length ? { OR: fsite.map((v) => (v === "aucun" ? { sites: { none: {} } } : v === "EN_CREATION" || v === "EN_LIGNE" ? { sites: { some: { status: v } } } : {})) } : {}] },
      orderBy: [{ reference: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, phone: true, reference: true, formule: true, createdAt: true, logoMiniPath: true, secteur: true, sites: { select: { name: true, status: true } }, memberships: { select: { user: { select: { firstName: true, lastName: true, email: true } } } }, commercial: { select: { firstName: true, email: true } }, developpeur: { select: { firstName: true, email: true } }, crmProspect: { select: { telephone: true } },
        contrats: { where: { statut: "SIGNE" }, select: { montantMensuelHt: true, finEngagement: true, impayeAt: true, regulariseAt: true } }, _count: { select: { documentRequests: { where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" } }, taches: { where: { statut: "A_FAIRE" } }, orders: { where: { status: "A_TRAITER" } } } } },
    }),
    prisma.user.findMany({ where: { role: { in: MODULES.suivi } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, role: true } }),
    prisma.savedView.findMany({ where: { userId: me.id, espace: "clients" }, orderBy: { createdAt: "asc" } }),
  ]);
  const [contacts, rdv, modifs] = await Promise.all([derniersContacts(clients.map((c) => c.id)), clientsAvecRdvAVenir(clients.map((c) => c.id)), prisma.changeRequest.groupBy({ by: ["siteId"], where: { status: { not: "TERMINEE" }, site: { clientId: { in: clients.map((c) => c.id) } } }, _count: true })]);
  const sitesClients = await prisma.site.findMany({ where: { clientId: { in: clients.map((c) => c.id) } }, select: { id: true, clientId: true } });
  const modifsParClient = new Map<string, number>();
  for (const m of modifs) { const s = sitesClients.find((x) => x.id === m.siteId); if (s) modifsParClient.set(s.clientId, (modifsParClient.get(s.clientId) ?? 0) + m._count); }
  const { end } = todayBounds();
  const now = end.getTime();
  let visibles = clients.filter((c) => matchRecherche(q, [c.name, c.email, c.secteur, c.memberships.map((m) => `${m.user.firstName ?? ""} ${m.user.lastName ?? ""} ${m.user.email}`).join(" ")], [c.phone, c.crmProspect?.telephone]));
  const jours = (c: (typeof clients)[number]) => { const d = contacts.get(c.id); return d ? Math.floor((end.getTime() - d.getTime()) / 86400_000) : null; };
  if (falerte.length) {
    const tests: Record<string, (c: (typeof visibles)[number]) => boolean> = {
      "60j": (c) => (jours(c) === null || jours(c)! >= JOURS_SANS_CONTACT) && !rdv.has(c.id),
      demandes: (c) => (modifsParClient.get(c.id) ?? 0) + c._count.orders > 0,
      docs: (c) => c._count.documentRequests > 0,
      impaye: (c) => c.contrats.some((x) => x.impayeAt && !x.regulariseAt),
      echeance: (c) => c.contrats.some((x) => x.finEngagement && x.finEngagement.getTime() - now < 90 * 86400_000 && x.finEngagement.getTime() > now),
    };
    visibles = visibles.filter((c) => falerte.some((a) => tests[a]?.(c))); // plusieurs situations cochées = l'une ou l'autre
  }
  if (sp.tri === "contact") visibles.sort((a, b) => (contacts.get(a.id)?.getTime() ?? 0) - (contacts.get(b.id)?.getTime() ?? 0));
  if (sp.tri === "recent") visibles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (sp.tri === "mensuel") visibles.sort((a, b) => b.contrats.reduce((x, y) => x + y.montantMensuelHt, 0) - a.contrats.reduce((x, y) => x + y.montantMensuelHt, 0));
  const total = visibles.length;
  const pageRows = visibles.slice((page - 1) * PAGE, page * PAGE);
  const finance = can(me, "finance");
  const lignes: Ligne[] = pageRows.map((c) => {
    const echeance = c.contrats.map((x) => x.finEngagement).filter((d): d is Date => !!d && d.getTime() > now).sort((a, b) => a.getTime() - b.getTime())[0];
    return {
      id: c.id, name: c.name, logo: c.logoMiniPath, secteur: c.secteur, reference: c.reference, formule: c.formule ? FORMULE[c.formule].label : null, referent: c.commercial ? teamName(c.commercial) : null, dev: c.developpeur ? teamName(c.developpeur) : null,
      sites: c.sites.map((s) => ({ name: s.name, statut: SITE_STATUS[s.status].label, tone: SITE_STATUS[s.status].tone })), dernierContact: contacts.get(c.id) ? fmtDate(contacts.get(c.id)!) : null, joursSansContact: jours(c), rdvAVenir: rdv.has(c.id),
      echeance: echeance ? fmtDate(echeance) : null, mensuel: finance ? fmtPrice(c.contrats.reduce((a, x) => a + x.montantMensuelHt, 0)) : null,
      demandes: (modifsParClient.get(c.id) ?? 0) + c._count.orders, docs: c._count.documentRequests, impaye: c.contrats.some((x) => x.impayeAt && !x.regulariseAt), taches: c._count.taches,
    };
  });
  const params = Object.fromEntries(Object.entries({ vue, q, c: sp.c ?? "", f: sp.f ?? "", site: sp.site ?? "", dev: sp.dev ?? "", secteur: sp.secteur ?? "", alerte: sp.alerte ?? "", tri: sp.tri ?? "" }).filter(([, v]) => v)) as Record<string, string>;
  const href = (patch: Partial<SP>) => `/admin/clients?${new URLSearchParams(Object.fromEntries(Object.entries({ ...params, ...patch }).filter(([, v]) => v)) as Record<string, string>)}`;
  const sel = "h-9 appearance-none rounded-full border border-border bg-surface px-3 text-xs text-title outline-none hover:border-text";
  const sansContact = visibles.filter((c) => (jours(c) === null || jours(c)! >= JOURS_SANS_CONTACT) && !rdv.has(c.id)).length;
  return (
    <AdminPage title="Clients" wide action={!estExterne(me) ? <Button href="/admin/clients/nouveau" size="sm"><Plus size={16} /> Nouveau client</Button> : undefined}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          {[["me", "Mes clients"], ["tous", "Tous les clients"], ["archives", "Archivés"]].map(([k, l]) => <Link key={k} href={href({ vue: k })} className={cn("rounded-full px-3 py-1.5", vue === k ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{l}</Link>)}
        </div>
        <form method="get" action="/admin/clients" className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="vue" value={vue} />
          <label className="relative min-w-40 flex-1"><SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden /><input name="q" defaultValue={q} placeholder="Nom, secteur, gérant, email, téléphone" className="h-9 w-full rounded-full border border-border bg-surface pr-3 pl-9 text-sm text-title placeholder:text-muted outline-none focus:border-blue" /></label>
          <MultiSelect name="c" label="Tous les référents" defaultValue={fc} options={equipe.filter((u) => MODULES.prospection.includes(u.role)).map((u) => ({ value: u.id, label: teamName(u) }))} />
          <MultiSelect name="dev" label="Tous les développeurs" defaultValue={fdev} options={equipe.filter((u) => u.role !== "COMMERCIAL").map((u) => ({ value: u.id, label: teamName(u) }))} />
          <MultiSelect name="f" label="Toutes formules" defaultValue={ff} options={Object.entries(FORMULE).map(([k, v]) => ({ value: k, label: v.label }))} />
          <MultiSelect name="site" label="Tout statut de site" defaultValue={fsite} options={[{ value: "EN_CREATION", label: "Site en création" }, { value: "EN_LIGNE", label: "Site en ligne" }, { value: "aucun", label: "Sans site" }]} />
          <MultiSelect name="alerte" label="Toutes situations" defaultValue={falerte} options={[{ value: "60j", label: "Aucun échange depuis 60 j, sans RDV" }, { value: "demandes", label: "Demandes ou commandes ouvertes" }, { value: "docs", label: "Documents attendus" }, { value: "echeance", label: "Échéance de contrat sous 90 j" }, ...(finance ? [{ value: "impaye", label: "Impayé signalé" }] : [])]} />
          <input name="secteur" defaultValue={sp.secteur ?? ""} placeholder="Secteur" className="h-9 w-28 rounded-full border border-border bg-surface px-3 text-xs text-title placeholder:text-muted outline-none" />
          <select name="tri" defaultValue={sp.tri ?? ""} className={sel} aria-label="Tri"><option value="">Références puis nom</option><option value="contact">Dernier contact (ancien d’abord)</option><option value="recent">Plus récents</option>{finance && <option value="mensuel">Mensuel décroissant</option>}</select>
          <button type="submit" className="h-9 rounded-full border border-border px-3 text-xs text-text hover:text-title">Filtrer</button>
        </form>
      </div>
      <p className="mb-3 text-sm text-text">{total} client{total > 1 ? "s" : ""}{sansContact ? <> · <Link href={href({ alerte: "60j" })} className="font-semibold text-pink hover:underline">{sansContact} sans échange depuis {JOURS_SANS_CONTACT} jours et sans RDV</Link></> : ""}{total > PAGE ? ` · page ${page} / ${Math.ceil(total / PAGE)}` : ""}</p>
      <GrilleClients lignes={lignes} membres={equipe.map((u) => ({ id: u.id, name: teamName(u) }))} vues={vues.map((v) => ({ id: v.id, nom: v.nom, params: v.params as Record<string, string> })) as Vue[]} params={params} droits={{ attribuer: can(me, "attribuer"), archiver: can(me, "archiver"), finance, externe: estExterne(me) }} />
      {total > PAGE && <div className="mt-3 flex items-center justify-center gap-2 text-sm">{page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-full border border-border px-3 py-1.5 text-title">← Précédent</Link>}{page * PAGE < total && <Link href={href({ page: String(page + 1) })} className="rounded-full border border-border px-3 py-1.5 text-title">Suivant →</Link>}</div>}
    </AdminPage>
  );
}
