import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoClient } from "@/components/ui/logo-client";
import { addDays, fmtDate, fmtPrice } from "@/lib/format";
import { ROLE_LABEL, estCommercial } from "@/lib/roles";
import { bornes, cle } from "@/lib/bilans";
import { fmtDayTime, teamName, PIPELINE, STATUT, VIZ } from "@/lib/crm";
import { ActivityIcon, ChartColumnIcon, CreditCardIcon, TrendingUpIcon, UsersIcon, WalletIcon } from "lucide-react";
import { StackedBars, GroupedBars, LineChart } from "@/app/crm/stats/charts";
import { MoreList } from "@/components/ui/more-list";
import { TuilesPliables } from "@/components/ui/tuiles-pliables";
import { activiteParCollaborateur, projectionMrr } from "@/lib/pilotage";
import { CATEGORIES, caParCommercial, mrrHebdo, rentabiliteParClient, visionFinanciere } from "@/lib/finance";
import { STATUT_ABONNEMENT, encaissementsParMois, statsStripe } from "@/lib/stripe";
import { StripeButton } from "./stripe-button";
import { PROJECT_STEPS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { ArchiverChargeButton, ChargeForm } from "./charges-form";

export const metadata = { title: "Pilotage" };
const ONGLETS = [["vue", "Vue d’ensemble"], ["finance", "Finance"], ["commercial", "Commercial"], ["production", "Production"], ["clients", "Clients et rentabilité"], ["charges", "Charges"], ["strategie", "Stratégie et décisions"], ["reunions", "Réunions et rapports"], ["assistant", "Assistant IA"]] as const;
type Onglet = (typeof ONGLETS)[number][0];
const euros = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c / 100);

/** Module Pilotage (16.1) : un onglet par direction, chiffres issus des saisies réelles, estimations signalées comme telles. */
export default async function PilotagePage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const me = await requireAdmin();
  const finance = can(me, "finance");
  const sp = await searchParams;
  const onglet: Onglet = (ONGLETS.some(([k]) => k === sp.onglet) ? sp.onglet : "vue") as Onglet;
  const nav = (
    <nav className="mb-5 -mx-4 border-b border-border px-4"><ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{ONGLETS.map(([k, l]) => <li key={k} className="shrink-0"><Link href={`/admin/pilotage${k === "vue" ? "" : `?onglet=${k}`}`} className={cn("-mb-px block border-b-2 px-2.5 py-2.5 text-sm", onglet === k ? "border-title font-semibold text-title" : "border-transparent text-text hover:text-title")}>{l}</Link></li>)}</ul></nav>
  );
  return (
    <AdminPage title="Pilotage" wide>
      {nav}
      {onglet === "vue" && <VueEnsemble finance={finance} />}
      {onglet === "finance" && (finance ? <Finance /> : <p className="text-sm text-text">Réservé au droit finance.</p>)}
      {onglet === "commercial" && <Commercial />}
      {onglet === "production" && <Production />}
      {onglet === "clients" && (finance ? <Clients /> : <p className="text-sm text-text">Réservé au droit finance.</p>)}
      {onglet === "charges" && (finance ? <Charges /> : <p className="text-sm text-text">Réservé au droit finance.</p>)}
      {(onglet === "strategie" || onglet === "reunions" || onglet === "assistant") && <PlusTard onglet={onglet} />}
    </AdminPage>
  );
}

async function VueEnsemble({ finance }: { finance: boolean }) {
  const in60 = addDays(60);
  const [v, clients, sitesEnLigne, enCreation, engagements, validations, activites, risque, hebdo, parCommercial] = await Promise.all([
    visionFinanciere(), prisma.client.count({ where: { archivedAt: null } }), prisma.site.count({ where: { status: "EN_LIGNE" } }), prisma.site.count({ where: { status: "EN_CREATION" } }),
    prisma.contrat.count({ where: { statut: "SIGNE", finEngagement: { gte: new Date(), lte: in60 } } }),
    prisma.validation.count({ where: { statut: "EN_ATTENTE" } }),
    prisma.activite.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { firstName: true, email: true } } } }),
    prisma.tacheClient.count({ where: { statut: "A_FAIRE", echeance: { lt: new Date() } } }),
    finance ? mrrHebdo() : Promise.resolve([]),
    finance ? caParCommercial() : Promise.resolve([]),
  ]);
  const court = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const mrrPoints = hebdo.map((p) => ({ label: fmtDate(p.date), court: court.format(p.date), value: Math.round(p.mrr) / 100 }));
  const tiles = [
    ...(finance ? [{ n: euros(v.mrr), label: "MRR (contrats signés)" }, { n: euros(v.nouveauMrr), label: "nouveau MRR ce mois" }, { n: euros(v.chargesMois.total), label: "charges du mois (saisies)" }, { n: euros(v.resultat), label: "résultat mensuel estimé" }] : []),
    { n: String(clients), label: "clients actifs" }, { n: String(sitesEnLigne), label: "sites en ligne" }, { n: String(enCreation), label: "sites en production" },
    { n: String(engagements), label: "échéances de contrat sous 60 jours" }, { n: String(validations), label: "validations en attente" }, { n: String(risque), label: "tâches client en retard" },
    ...(finance ? [{ n: String(v.impayes.length), label: "impayés signalés" }] : []),
  ];
  return (
    <>
      <SectionTitle icon={ChartColumnIcon}>Santé de la société</SectionTitle>
      {/* Première rangée de tuiles seulement, le reste derrière « Voir plus ». */}
      <TuilesPliables tuiles={tiles} />
      <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-10">
        {finance && mrrPoints.length > 0 && (
          <div>
            <SectionTitle icon={TrendingUpIcon}>MRR</SectionTitle>
            <Card>
              <p className="font-title text-2xl font-extrabold text-title">{euros(v.mrr)}</p>
              <p className="mb-3 text-xs text-text">par mois HT, contrats signés en cours · semaine par semaine depuis le premier contrat</p>
              <LineChart points={mrrPoints} unite=" €" />
            </Card>
            {/* Qui a signé combien : MRR HT et ponctuels par commercial (référent du client). */}
            {parCommercial.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface"><table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] tracking-wide text-text uppercase"><th className="px-3 py-2 font-semibold">Commercial</th><th className="px-3 py-2 text-right font-semibold">Clients</th><th className="px-3 py-2 text-right font-semibold">MRR HT</th><th className="px-3 py-2 text-right font-semibold">Part</th><th className="px-3 py-2 text-right font-semibold">Ponctuels</th></tr></thead>
                <tbody className="divide-y divide-border">{parCommercial.map((r) => <tr key={r.id ?? "-"}><td className="px-3 py-2 font-semibold text-title">{r.nom}</td><td className="px-3 py-2 text-right tabular-nums">{r.clients}</td><td className="px-3 py-2 text-right tabular-nums">{euros(r.mrr)}</td><td className="px-3 py-2 text-right tabular-nums text-text">{r.part} %</td><td className="px-3 py-2 text-right tabular-nums text-text">{r.ponctuel ? euros(r.ponctuel) : "—"}</td></tr>)}</tbody>
              </table></div>
            )}
            {/* Impayés signalés (d'après Stripe ou à la main), sous la courbe. */}
            {v.impayes.length > 0 && <ul className="mt-3 space-y-1 text-sm">{v.impayes.map((i) => <li key={i.id}><Link href={`/admin/contrats/${i.id}`} className="text-pink hover:underline">Impayé : {i.client?.name ?? i.reference} · {i.reference} · depuis le {i.impayeAt ? fmtDate(i.impayeAt) : ""}</Link></li>)}</ul>}
          </div>
        )}
        <div className="lg:pl-6">
          <SectionTitle icon={ActivityIcon}>Événements récents</SectionTitle>
          {/* Cinq événements, le reste derrière « Voir plus » (MoreList), pour ne pas allonger la page. */}
          <MoreList title="Événements récents" limit={5} labels={activites.map((a) => a.texte)} className="space-y-2 border-l border-border pl-4" items={activites.map((a) => (
            <div key={a.id} className="relative text-sm"><span className="absolute top-2 -left-[21px] size-2 rounded-full bg-blue" />{a.href ? <Link href={a.href} className="text-text-strong hover:underline">{a.texte}</Link> : <span className="text-text-strong">{a.texte}</span>}<p className="text-xs text-text">{fmtDayTime(a.createdAt)}{a.user ? ` · ${teamName(a.user)}` : ""}</p></div>
          ))} />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">Estimations basées sur les saisies (contrats, charges) : la comptabilité officielle reste dans Pennylane. Mise à jour en temps réel.</p>
    </>
  );
}

async function Finance() {
  const [v, projection, st, encaisse] = await Promise.all([visionFinanciere(), projectionMrr(), statsStripe(), encaissementsParMois()]);
  // Courbe : on ajoute l'encaissé réel Stripe quand il existe (mois passés et en cours uniquement).
  const points = st.derniereSync ? v.points.map((p) => (encaisse.has(p.key) ? { ...p, values: { ...p.values, encaisse: Math.round((encaisse.get(p.key) ?? 0) / 100) } } : p)) : v.points;
  const series = [{ key: "revenus", label: "Revenus (MRR + ponctuels)", color: VIZ.green }, ...(st.derniereSync ? [{ key: "encaisse", label: "Encaissé Stripe", color: VIZ.violet }] : []), { key: "charges", label: "Charges saisies", color: VIZ.orange }, { key: "resultat", label: "Résultat estimé", color: VIZ.blue }];
  const ecart = st.mrr - v.mrr;
  return (
    <>
      <SectionTitle icon={CreditCardIcon} action={<StripeButton derniereSync={st.derniereSync ? fmtDayTime(st.derniereSync) : null} />}>Stripe (données réelles)</SectionTitle>
      {!st.configure && <Card><p className="text-sm text-text">Connecteur Stripe non configuré : renseignez la clé dans <Link href="/admin/parametres" className="underline">Paramètres</Link> (Stripe) puis activez-le dans « IA et intégrations ».</p></Card>}
      {st.configure && st.erreur && <Card className="border-pink/50"><p className="text-sm text-pink">Dernière actualisation en erreur ({fmtDayTime(st.erreur.createdAt)}) : {st.erreur.message}</p></Card>}
      {st.configure && !st.derniereSync && !st.erreur && <Card><p className="text-sm text-text">Aucune donnée pour l’instant : cliquez sur « Actualiser Stripe ».</p></Card>}
      {st.derniereSync && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { n: euros(st.mrr), l: "MRR Stripe (abonnements actifs)", sub: `${ecart === 0 ? "égal aux contrats" : `${ecart > 0 ? "+" : "−"}${euros(Math.abs(ecart))} vs contrats signés`}` },
              { n: String(st.actifs), l: "abonnements actifs", sub: `${st.enEssai ? `${st.enEssai} en essai · ` : ""}${st.annulationsPrevues.length} annulation${st.annulationsPrevues.length > 1 ? "s" : ""} prévue${st.annulationsPrevues.length > 1 ? "s" : ""}` },
              { n: euros(st.encaisseMois), l: "encaissé ce mois", sub: `${st.facturesPayeesMois} facture${st.facturesPayeesMois > 1 ? "s" : ""} · mois dernier ${euros(st.encaisseMoisPrecedent)}` },
              { n: euros(st.impayesTotal), l: "factures impayées", sub: `${st.impayes.length} facture${st.impayes.length > 1 ? "s" : ""} · ${st.enRetard.length} abonnement${st.enRetard.length > 1 ? "s" : ""} en retard`, tone: st.impayesTotal > 0 ? "pink" : undefined },
            ].map((t) => <Card key={t.l}><p className={cn("font-title text-2xl font-extrabold", t.tone === "pink" ? "text-pink" : "text-title")}>{t.n}</p><p className="mt-1 text-xs text-text">{t.l}</p><p className="mt-0.5 text-[11px] text-muted">{t.sub}</p></Card>)}
          </div>
          {st.impayes.length > 0 && (
            <>
              <SectionTitle>Factures impayées (Stripe)</SectionTitle>
              <div className="overflow-x-auto rounded-card border border-border bg-surface"><table className="w-full text-sm">
                <thead className="text-left text-xs text-text"><tr><th className="px-3 py-2 font-medium">Client</th><th className="px-3 py-2 font-medium">Facture</th><th className="px-3 py-2 text-right font-medium">Reste dû</th><th className="px-3 py-2 font-medium">Échéance</th><th className="px-3 py-2 font-medium">Statut</th></tr></thead>
                <tbody className="divide-y divide-border">{st.impayes.map((f) => <tr key={f.id}><td className="px-3 py-2 font-semibold text-title">{f.client ? <Link href={`/admin/clients/${f.client.id}`} className="hover:underline">{f.client.name}</Link> : <span title={f.customerEmail ?? ""}>{f.customerNom ?? f.customerEmail ?? f.customerId}</span>}</td><td className="px-3 py-2 text-xs">{f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.numero ?? f.id}</a> : (f.numero ?? f.id)}</td><td className="px-3 py-2 text-right tabular-nums text-pink">{euros(f.restantCents)}</td><td className="px-3 py-2 text-xs text-text">{f.echeanceAt ? fmtDate(f.echeanceAt) : fmtDate(f.creeAt)}</td><td className="px-3 py-2"><Badge tone={f.statut === "uncollectible" ? "pink" : "yellow"}>{f.statut === "uncollectible" ? "irrécouvrable" : "en attente"}</Badge></td></tr>)}</tbody>
              </table></div>
            </>
          )}
          <SectionTitle>Abonnements Stripe en cours</SectionTitle>
          <MoreList limit={8} title="Abonnements Stripe en cours" labels={st.abonnements.map((a) => `${a.client?.name ?? a.customerNom ?? a.customerEmail ?? ""} ${a.libelle}`)} items={st.abonnements.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2 text-sm"><span className="font-semibold text-title">{a.client ? <Link href={`/admin/clients/${a.client.id}`} className="hover:underline">{a.client.name}</Link> : <span title={a.customerEmail ?? ""}>{a.customerNom ?? a.customerEmail ?? a.customerId}</span>}{!a.client && <span className="ml-2 text-[11px] font-normal text-muted">sans fiche client</span>}</span><span className="text-xs text-text">{a.libelle}</span><span className="ml-auto tabular-nums text-text-strong">{euros(a.montantMensuelCents)}<span className="text-xs text-muted"> / mois</span></span><span className="w-full text-[11px] text-muted sm:w-auto">{a.statut === "active" ? (a.annulationAt ? `annulation le ${fmtDate(a.annulationAt)}` : a.periodeFinAt ? `prochain prélèvement ${fmtDate(a.periodeFinAt)}` : "actif") : <span className={a.statut === "past_due" || a.statut === "unpaid" ? "text-pink" : ""}>{STATUT_ABONNEMENT[a.statut] ?? a.statut}</span>}</span></li>)} className="divide-y divide-border rounded-card border border-border bg-surface" />
          <p className="mt-2 text-xs text-muted">Lecture seule, mise à jour au clic et toutes les 6 h. Montants Stripe hors remises. {st.nonRapproches > 0 && `${st.nonRapproches} abonnement${st.nonRapproches > 1 ? "s" : ""} sans fiche client : l’email du client Stripe ne correspond à aucune fiche (email de la fiche, du signataire ou d’un contact).`}</p>
        </>
      )}

      <SectionTitle icon={WalletIcon}>Finance (V1 : saisies manuelles)</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ n: euros(v.mrr), l: "MRR actif" }, { n: euros(v.nouveauMrr), l: "nouveau MRR du mois" }, { n: euros(v.mrrPerdu), l: "MRR perdu (contrats terminés)" }, { n: euros(v.ponctuelMois), l: "ponctuels signés ce mois" }, { n: euros(v.chargesMois.total), l: "charges du mois" }, { n: euros(v.chargesMois.principales), l: "dont charges fixes principales" }, { n: euros(v.resultat), l: "résultat mensuel estimé" }, { n: String(v.impayes.length), l: "impayés signalés" }].map((t) => <Card key={t.l}><p className="font-title text-2xl font-extrabold text-title">{t.n}</p><p className="mt-1 text-xs text-text">{t.l}</p></Card>)}
      </div>
      <SectionTitle icon={TrendingUpIcon}>Résultat mensuel estimé : 12 mois et projection</SectionTitle>
      <Card><GroupedBars buckets={points} series={series} /><p className="mt-2 text-xs text-muted">En euros. Historique reconstitué d’après les dates de signature et de fin ; projection = contrats en cours et charges connues.{st.derniereSync && " « Encaissé Stripe » = factures réellement payées (TTC)."} Pas une comptabilité.</p></Card>
      <SectionTitle>Répartition des charges du mois</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">{Object.entries(v.chargesMois.parCategorie).sort((a, b) => b[1] - a[1]).map(([k, c]) => <li key={k} className="flex justify-between px-4 py-2"><span className="text-title">{CATEGORIES[k] ?? k}</span><span className="tabular-nums text-text-strong">{euros(c)}</span></li>)}{Object.keys(v.chargesMois.parCategorie).length === 0 && <li className="px-4 py-2 text-text">Aucune charge saisie : onglet Charges.</li>}</ul>
      <SectionTitle>Projection du MRR (pipeline pondéré)</SectionTitle>
      <Card><p className="mb-3 text-sm text-text">MRR abonnements <span className="font-semibold text-title">{fmtPrice(projection.mrr * 100)}</span> · à risque sous 3 mois <span className="font-semibold text-pink">{fmtPrice(projection.aRisque3Mois * 100)}</span> · pipeline pondéré <span className="font-semibold text-green">{fmtPrice(projection.pondere * 100)}</span> / mois</p><StackedBars buckets={projection.points} series={[{ key: "acquis", label: "Acquis", color: VIZ.blue }, { key: "risque", label: "Engagement terminé", color: VIZ.orange }, { key: "pipeline", label: "Pipeline pondéré", color: VIZ.green }]} /></Card>
    </>
  );
}

async function Commercial() {
  // Mois calendaire en cours (du 1er à aujourd'hui), comme les bilans individuels : chaque compteur ouvre la liste exacte qu'il compte.
  const mois = bornes("MENSUEL", new Date());
  const [parStade, collaborateurs, rdv, parrainages] = await Promise.all([
    prisma.prospect.groupBy({ by: ["statut"], _count: true }),
    activiteParCollaborateur({ debut: mois.debut, fin: mois.fin }),
    prisma.rendezVous.groupBy({ by: ["resultat"], where: { debut: { gte: mois.debut, lt: mois.fin } }, _count: true }),
    prisma.referral.groupBy({ by: ["status"], _count: true }),
  ]);
  const commerciaux = collaborateurs.filter(estCommercial);
  const n = (s: string) => parStade.find((p) => p.statut === s)?._count ?? 0;
  const detail = (id: string, ind: "rdv" | "signatures" | "ca") => `/crm/bilan/${id}/detail?ind=${ind}&periode=MENSUEL&debut=${cle(mois.debut)}`;
  const num = "block px-3 py-2 text-right tabular-nums hover:underline";
  return (
    <>
      <SectionTitle icon={ChartColumnIcon}>Pipeline (agrégats de Prospection)</SectionTitle>
      {/* Chaque tuile ouvre « Tous les prospects » filtré sur ce statut (chaque fiche s'ouvre depuis la liste). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[...PIPELINE, "GAGNE" as const, "PERDU" as const].map((s) => <Link key={s} href={`/crm/prospects?s=${s}`} title={`Voir les prospects « ${STATUT[s].label} »`} className="block rounded-card border border-border bg-surface p-4 transition-colors hover:border-text"><p className="font-title text-2xl font-extrabold text-title">{n(s)}</p><p className="mt-1 text-xs text-text">{STATUT[s].label}</p></Link>)}</div>
      <p className="mt-2 text-xs text-text">RDV sur {mois.label.toLowerCase()} : {rdv.map((r) => `${r._count} ${r.resultat.toLowerCase()}`).join(" · ") || "aucun"} · parrainages : {parrainages.map((p) => `${p._count} ${p.status.toLowerCase().replace("_", " ")}`).join(" · ") || "aucun"}</p>
      <SectionTitle icon={UsersIcon}>Activité des commerciaux <span className="text-sm font-normal text-text">{mois.label}</span></SectionTitle>
      <div className="overflow-x-auto rounded-card border border-border bg-surface"><table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] tracking-wide text-text uppercase"><th className="px-3 py-2 font-semibold">Commercial</th><th className="px-3 py-2 font-semibold">Rôle</th><th className="px-3 py-2 text-right font-semibold">Échanges</th><th className="px-3 py-2 text-right font-semibold">RDV pris</th><th className="px-3 py-2 text-right font-semibold">Signatures</th><th className="px-3 py-2 text-right font-semibold">CA signé</th><th className="px-3 py-2 text-right font-semibold">Modifs</th><th className="px-3 py-2 text-right font-semibold">Actions</th><th className="px-3 py-2 text-right font-semibold">Clients · sites</th></tr></thead>
        <tbody className="divide-y divide-border">{commerciaux.map((c) => <tr key={c.id}><td className="px-3 py-2 font-semibold text-title"><Link href={`/crm/bilan/${c.id}?periode=MENSUEL&debut=${cle(mois.debut)}`} className="hover:underline" title="Fiche individuelle : objectifs, bilans, historique">{c.nom}</Link></td><td className="px-3 py-2 text-xs text-text">{ROLE_LABEL[c.role]}</td><td className="px-3 py-2 text-right tabular-nums">{c.echanges}</td><td className="p-0"><Link href={detail(c.id, "rdv")} className={num} title="Liste des RDV pris, avec lien vers chaque fiche">{c.rdv}</Link></td><td className="p-0"><Link href={detail(c.id, "signatures")} className={num} title="Liste des fiches gagnées">{c.signatures}</Link></td><td className="p-0"><Link href={detail(c.id, "ca")} className={num} title="Détail du CA signé">{c.ca ? euros(c.ca * 100) : "—"}</Link></td><td className="px-3 py-2 text-right tabular-nums">{c.modifs}</td><td className="px-3 py-2 text-right tabular-nums">{c.actions}</td><td className="px-3 py-2 text-right text-xs text-text tabular-nums">{c.clients} · {c.sites}</td></tr>)}</tbody>
      </table></div>
      <p className="mt-2 text-xs text-muted">{commerciaux.length} commercial{commerciaux.length > 1 ? "aux" : ""} : les membres de l’équipe Commerciale (réglée dans Prospection → Équipe), Direction comprise ; les autres membres n’apparaissent pas dans les statistiques commerciales. Cliquez un nom pour sa fiche individuelle, un chiffre pour la liste de ce qu’il compte. Les données sources restent dans Prospection ; ici des agrégats.</p>
    </>
  );
}

async function Production() {
  const now = new Date();
  const [sites, validations, livres, modifs, retard] = await Promise.all([
    prisma.site.findMany({ where: { status: "EN_CREATION" }, select: { projectStep: true, developpeur: { select: { firstName: true, email: true } }, deadlineV1: true, deadlineV2: true, deadlineLivraison: true } }),
    prisma.validation.groupBy({ by: ["type"], where: { statut: "EN_ATTENTE" }, _count: true }),
    prisma.site.count({ where: { status: "EN_LIGNE", launchedAt: { gte: addDays(-30) } } }),
    prisma.changeRequest.count({ where: { status: { not: "TERMINEE" } } }),
    prisma.tacheClient.count({ where: { statut: "A_FAIRE", echeance: { lt: now } } }),
  ]);
  const enRetard = sites.filter((s) => { const d = PROJECT_STEPS.find((p) => p.key === s.projectStep)!.deadline; const v = s[d]; return v && v < now; }).length;
  const charge = new Map<string, number>();
  for (const s of sites) { const k = s.developpeur ? teamName(s.developpeur) : "Sans développeur"; charge.set(k, (charge.get(k) ?? 0) + 1); }
  return (
    <>
      <SectionTitle icon={ChartColumnIcon}>Production et capacité</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PROJECT_STEPS.map((p) => <Card key={p.key}><p className="font-title text-2xl font-extrabold text-title">{sites.filter((s) => s.projectStep === p.key).length}</p><p className="mt-1 text-xs text-text">{p.label}</p></Card>)}
        <Card><p className="font-title text-2xl font-extrabold text-title">{livres}</p><p className="mt-1 text-xs text-text">sites livrés sur 30 jours</p></Card>
        <Card><p className="font-title text-2xl font-extrabold text-title">{enRetard}</p><p className="mt-1 text-xs text-text">sites en retard sur l’échéance</p></Card>
        <Card><p className="font-title text-2xl font-extrabold text-title">{modifs}</p><p className="mt-1 text-xs text-text">demandes de modification ouvertes</p></Card>
        <Card><p className="font-title text-2xl font-extrabold text-title">{retard}</p><p className="mt-1 text-xs text-text">tâches en retard</p></Card>
      </div>
      <SectionTitle>Validations en attente</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">{validations.map((v) => <li key={v.type} className="flex justify-between px-4 py-2"><span className="text-title">{v.type.toLowerCase().replace(/_/g, " ")}</span><span className="tabular-nums">{v._count}</span></li>)}{validations.length === 0 && <li className="px-4 py-2 text-text">Aucune.</li>}</ul>
      <SectionTitle>Charge par développeur</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">{[...charge.entries()].map(([k, n]) => <li key={k} className="flex justify-between px-4 py-2"><span className="text-title">{k}</span><span className="tabular-nums">{n} site{n > 1 ? "s" : ""}</span></li>)}</ul>
      <p className="mt-2 text-xs text-muted">Temps réel par développeur, coûts et temps gratuits : à saisir sur les projets (prévu, non chiffré ici pour ne rien inventer).</p>
    </>
  );
}

async function Clients() {
  const rows = await rentabiliteParClient();
  return (
    <>
      <SectionTitle icon={UsersIcon}>Rentabilité par client (V1 : revenu contractuel moins coûts saisis)</SectionTitle>
      <div className="overflow-x-auto rounded-card border border-border bg-surface"><table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] tracking-wide text-text uppercase"><th className="px-3 py-2 font-semibold">Client</th><th className="px-3 py-2 font-semibold">Référent</th><th className="px-3 py-2 text-right font-semibold">Mensuel HT</th><th className="px-3 py-2 text-right font-semibold">Ponctuel signé</th><th className="px-3 py-2 text-right font-semibold">Coûts saisis / mois</th><th className="px-3 py-2 text-right font-semibold">Marge estimée</th><th className="px-3 py-2 font-semibold">Signaux</th></tr></thead>
        <tbody className="divide-y divide-border">{rows.map((r) => <tr key={r.id}><td className="px-3 py-2"><Link href={`/admin/clients/${r.id}`} className="flex items-center gap-2 font-semibold text-title hover:underline"><LogoClient id={r.id} name={r.name} logo={r.logo} size={24} /> {r.name}</Link></td><td className="px-3 py-2 text-xs text-text">{r.referent ? teamName(r.referent) : "—"}</td><td className="px-3 py-2 text-right tabular-nums">{euros(r.mensuel)}</td><td className="px-3 py-2 text-right tabular-nums">{euros(r.ponctuel)}</td><td className="px-3 py-2 text-right tabular-nums">{euros(r.coutsMensuels)}</td><td className={cn("px-3 py-2 text-right tabular-nums", r.marge < 0 ? "text-pink" : "text-green")}>{euros(r.marge)}</td><td className="px-3 py-2 text-xs">{r.impaye && <Badge tone="pink">impayé</Badge>}{r.sitesEnLigne === 0 && <Badge tone="neutral">aucun site en ligne</Badge>}</td></tr>)}</tbody>
      </table></div>
      <p className="mt-2 text-xs text-muted">Chiffres approximatifs : coûts = charges rattachées au client (prestataires, interventions valorisées). LTV, churn et temps productif : à venir avec les saisies de temps.</p>
    </>
  );
}

async function Charges() {
  const [charges, clients] = await Promise.all([prisma.charge.findMany({ where: { archivedAt: null }, orderBy: [{ principale: "desc" }, { type: "asc" }, { montantCents: "desc" }] }), prisma.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  const cats = Object.entries(CATEGORIES) as [string, string][];
  const init = (c?: (typeof charges)[number]) => ({ id: c?.id, nom: c?.nom ?? "", montant: c ? (c.montantCents / 100).toString() : "", categorie: c?.categorie ?? "logiciels", type: c?.type ?? "MENSUELLE" as const, principale: c?.principale ?? false, debut: (c?.debut ?? new Date()).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }), fin: c?.fin ? c.fin.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }) : "", commentaire: c?.commentaire ?? "", clientId: c?.clientId ?? "" });
  const mens = charges.filter((c) => c.type === "MENSUELLE"), ponct = charges.filter((c) => c.type === "PONCTUELLE");
  return (
    <>
      <SectionTitle icon={WalletIcon}>Ajouter une charge</SectionTitle>
      <Card><ChargeForm init={init()} categories={cats} clients={clients} /></Card>
      <SectionTitle>Charges mensuelles ({mens.length}) · {euros(mens.reduce((a, c) => a + c.montantCents, 0))} / mois</SectionTitle>
      <div className="grid gap-2">{mens.map((c) => <details key={c.id} className="rounded-card border border-border bg-surface"><summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm"><span className="flex-1 font-semibold text-title">{c.nom}{c.principale && <Badge tone="blue" className="ml-2">principale</Badge>}</span><span className="text-xs text-text">{CATEGORIES[c.categorie] ?? c.categorie} · depuis {fmtDate(c.debut)}{c.fin ? ` jusqu’au ${fmtDate(c.fin)}` : ""}</span><span className="tabular-nums text-text-strong">{euros(c.montantCents)}</span></summary><div className="border-t border-border p-4"><ChargeForm init={init(c)} categories={cats} clients={clients} /><div className="mt-2"><ArchiverChargeButton id={c.id} /></div></div></details>)}{mens.length === 0 && <p className="text-sm text-text">Aucune charge mensuelle saisie.</p>}</div>
      <SectionTitle>Charges ponctuelles ({ponct.length})</SectionTitle>
      <div className="grid gap-2">{ponct.map((c) => <details key={c.id} className="rounded-card border border-border bg-surface"><summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm"><span className="flex-1 font-semibold text-title">{c.nom}</span><span className="text-xs text-text">{CATEGORIES[c.categorie] ?? c.categorie} · {fmtDate(c.debut)}</span><span className="tabular-nums text-text-strong">{euros(c.montantCents)}</span></summary><div className="border-t border-border p-4"><ChargeForm init={init(c)} categories={cats} clients={clients} /><div className="mt-2"><ArchiverChargeButton id={c.id} /></div></div></details>)}{ponct.length === 0 && <p className="text-sm text-text">Aucune charge ponctuelle saisie.</p>}</div>
    </>
  );
}

function PlusTard({ onglet }: { onglet: string }) {
  const t = { strategie: ["Stratégie et décisions", "Prévisions 3/6/12 mois, scénarios, décisions et arbitrages validés par des humains avec porteurs et échéances."], reunions: ["Réunions et rapports", "Comptes rendus saisis par les participants (pas de transcription), rapports hebdomadaires et mensuels, exports PDF/CSV."], assistant: ["Assistant IA de direction", "Optionnel et désactivable (00.6) : contradicteur analytique, n’exécute aucune décision financière ni juridique."] }[onglet] ?? ["", ""];
  return <Card><p className="font-semibold text-title">{t[0]}</p><p className="mt-1 text-sm text-text">{t[1]}</p><p className="mt-2 text-xs text-muted">Prévu après la V1 : aucune donnée fictive n’est affichée en attendant.</p></Card>;
}
