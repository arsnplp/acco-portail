import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { can, estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { fmtDate, fmtPrice } from "@/lib/format";
import { fmtDayTime, teamName } from "@/lib/crm";
import { CONTRAT_STATUT, MOYEN_PAIEMENT_LABEL, lienPdf, productionAutorisee, signataireParDefaut, chargerContrat } from "@/lib/contrats";
import { VALIDATION_LABEL } from "@/lib/validations";
import { activePromo } from "@/lib/offers";
import { PaiementButtons } from "@/app/admin/clients/[id]/forms";
import { ContratForm } from "../form";
import { AvenantButton, CloreButton, DerogationForm, EnvoyerForm, GenererPdfButton, ScanForm } from "./boutons";
import { ClipboardCheckIcon, FileSignatureIcon, HistoryIcon } from "lucide-react";

/** Détail d'un contrat : statut, PDF, envoi/relance, acceptation, scan, paiement, dérogation, avenants, validations, journal. */
export default async function ContratPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireTeam();
  if (estExterne(me)) redirect("/admin");
  const { id } = await params;
  const c = await chargerContrat(id);
  if (!c) notFound();
  const finance = can(me, "finance");
  const [full, validations, journal, pdfUrl, scanUrl, certUrl, destinataire, prod, offres, sites] = await Promise.all([
    prisma.contrat.findUniqueOrThrow({ where: { id }, include: { avenants: { select: { id: true, reference: true, statut: true, version: true } }, parent: { select: { id: true, reference: true } }, subscriptions: { select: { id: true, label: true, status: true } }, lignes: { include: { site: { select: { name: true } } }, orderBy: { ordre: "asc" } } } }),
    prisma.validation.findMany({ where: { contratId: id }, orderBy: { createdAt: "asc" }, include: { assigne: { select: { firstName: true, email: true } }, decidePar: { select: { firstName: true, email: true } } } }),
    prisma.activite.findMany({ where: { href: `/admin/contrats/${id}` }, orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { firstName: true, email: true } } } }),
    lienPdf(c.pdfPath), lienPdf(c.scanPath), lienPdf(c.certificatPath), signataireParDefaut(c), productionAutorisee(id),
    c.statut === "BROUILLON" ? prisma.offer.findMany({ where: { isArchived: false }, orderBy: { order: "asc" }, include: { promotions: true, parent: { select: { name: true } } } }) : [],
    c.clientId ? prisma.site.findMany({ where: { clientId: c.clientId }, select: { id: true, name: true } }) : [],
  ]);
  const societe = c.client?.name ?? c.prospect?.societe ?? "—";
  const ouvert = c.statut === "ENVOYE" || c.statut === "CONSULTE";
  const exception = validations.find((v) => v.type === "EXCEPTION_TARIFAIRE" && v.statut !== "VALIDEE");
  const back = c.clientId ? { href: `/admin/clients/${c.clientId}?onglet=contrats`, label: societe } : c.prospectId ? { href: `/crm/prospects/${c.prospectId}`, label: societe } : { href: "/admin/contrats", label: "Contrats" };
  return (
    <AdminPage title={<span className="flex items-center gap-2">{c.reference}<Badge tone={CONTRAT_STATUT[c.statut].tone}>{CONTRAT_STATUT[c.statut].label}</Badge></span>} back={back} action={<CloreButton contratId={id} brouillon={c.statut === "BROUILLON"} />}>
      <p className="-mt-3 text-sm text-text">
        {c.titre} · {c.clientId ? <Link href={`/admin/clients/${c.clientId}`} className="text-title hover:underline">{societe}</Link> : c.prospectId ? <Link href={`/crm/prospects/${c.prospectId}`} className="text-title hover:underline">{societe} (prospect)</Link> : societe}
        {c.site ? ` · ${c.site.name}` : ""}{c.commercial ? ` · ${teamName(c.commercial)}` : ""} · version {c.version}{full.parent ? <> · avenant de <Link href={`/admin/contrats/${full.parent.id}`} className="text-title hover:underline">{full.parent.reference}</Link></> : null}
      </p>

      {/* État et actions */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-xs text-text">Montants HT</p><p className="mt-1 font-semibold text-title">{finance ? <>{fmtPrice(c.montantMensuelHt)} / mois{c.montantPonctuelHt ? ` + ${fmtPrice(c.montantPonctuelHt)}` : ""}</> : "réservé (droit finance)"}</p><p className="text-xs text-text">{c.moyenPaiement ? MOYEN_PAIEMENT_LABEL[c.moyenPaiement] : "moyen de paiement à convenir"}</p></Card>
        <Card><p className="text-xs text-text">Engagement</p><p className="mt-1 font-semibold text-title">{c.dureeMois} mois{c.debutEngagement ? ` dès le ${fmtDate(c.debutEngagement)}` : ""}</p><p className="text-xs text-text">{c.finEngagement ? `jusqu’au ${fmtDate(c.finEngagement)} · ` : ""}reconduction {c.reconductionMois} mois · préavis {c.preavisJours} j</p></Card>
        <Card><p className="text-xs text-text">Signature</p><p className="mt-1 font-semibold text-title">{c.signeAt ? `Signée le ${fmtDate(c.signeAt)}` : c.consulteAt ? `Consulté le ${fmtDate(c.consulteAt)}` : c.envoyeAt ? `Envoyé le ${fmtDate(c.envoyeAt)}` : c.refuseAt ? `Refusé le ${fmtDate(c.refuseAt)}` : "Brouillon"}</p><p className="text-xs text-text">{c.signataireNom ? `${c.signataireNom}${c.signataireEmail ? ` · ${c.signataireEmail}` : ""}` : destinataire ? `Destinataire : ${destinataire.email}` : "Pas d’email de contact"}{c.refusMotif ? ` · ${c.refusMotif}` : ""}</p></Card>
      </div>

      {exception && <p className="mt-3 rounded-card border border-yellow/40 bg-yellow/10 px-4 py-2 text-sm text-yellow">Exception tarifaire {exception.statut === "REFUSEE" ? "refusée" : "en attente de validation (Bilel ou Lucas)"} : l’envoi est bloqué{exception.motif ? ` · ${exception.motif}` : ""}.</p>}
      {c.statut === "SIGNE" && (
        <div className={`mt-3 rounded-card border px-4 py-3 text-sm ${prod.ok ? "border-green/40 bg-green/10 text-green" : "border-pink/40 bg-pink/10 text-pink"}`}>
          {prod.ok ? "Production autorisée : premier paiement reçu ou dérogation validée. Brief et portail sont ouverts depuis la signature." : `Production bloquée : ${prod.raison}. Brief et portail restent ouverts.`}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start gap-2">
        {c.statut !== "SIGNE" && c.statut !== "TERMINE" && <GenererPdfButton contratId={id} />}
        {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text">Ouvrir le PDF{c.pdfSha256 ? ` · SHA-256 ${c.pdfSha256.slice(0, 10)}…` : ""}</a>}
        {scanUrl && <a href={scanUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text">Scan signé</a>}
        {certUrl && <a href={certUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text">Certificat de preuve</a>}
        {(c.statut === "BROUILLON" || ouvert) && !exception && <EnvoyerForm contratId={id} defaut={destinataire} relance={ouvert} />}
        {c.statut === "SIGNE" && <AvenantButton contratId={id} />}
      </div>
      {(c.statut === "BROUILLON" || ouvert) && <div className="mt-3"><ScanForm contratId={id} /></div>}
      {c.statut === "SIGNE" && finance && (
        <div className="mt-4 space-y-3 rounded-card border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-title">Paiement (saisie manuelle, 00.10)</p>
          <PaiementButtons contratId={id} premierPaiement={!!c.premierPaiementAt} impaye={!!c.impayeAt && !c.regulariseAt} />
          <p className="text-xs text-text">{c.premierPaiementAt ? `Premier paiement reçu le ${fmtDayTime(c.premierPaiementAt)}` : "Premier paiement non reçu"}{c.premierPaiementAnnuleAt ? ` · saisie annulée le ${fmtDayTime(c.premierPaiementAnnuleAt)}` : ""}{c.impayeAt ? ` · impayé signalé le ${fmtDayTime(c.impayeAt)}` : ""}{c.regulariseAt ? ` · régularisé le ${fmtDayTime(c.regulariseAt)}` : ""}</p>
          {!c.premierPaiementAt && !prod.ok && <DerogationForm contratId={id} />}
        </div>
      )}

      {/* Lignes */}
      <SectionTitle icon={FileSignatureIcon}>Prestations ({full.lignes.length})</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
        {full.lignes.map((l) => <li key={l.id} className="flex items-center gap-3 px-4 py-2"><span className="min-w-0 flex-1 truncate text-title">{l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}{l.site ? <span className="text-xs text-text"> → {l.site.name}</span> : <span className="text-xs text-text"> → tous les sites / nouveau site</span>}</span>{finance && <span className="text-xs text-text-strong">{fmtPrice(l.montantHt)}{l.billing === "MENSUEL" ? " / mois" : ""}</span>}</li>)}
        {full.lignes.length === 0 && <li className="px-4 py-2 text-text">Aucune ligne.</li>}
      </ul>
      {full.subscriptions.length > 0 && <p className="mt-2 text-xs text-text">Abonnements créés à la signature : {full.subscriptions.map((s) => `${s.label} (${s.status.toLowerCase()})`).join(", ")}.</p>}
      {full.avenants.length > 0 && <p className="mt-2 text-sm text-text">Avenants : {full.avenants.map((a) => <Link key={a.id} href={`/admin/contrats/${a.id}`} className="mr-2 text-title hover:underline">{a.reference} · v{a.version} · {CONTRAT_STATUT[a.statut].label}</Link>)}</p>}

      {c.statut === "BROUILLON" && (
        <>
          <SectionTitle>Modifier le brouillon</SectionTitle>
          <ContratForm pour={societe} clientId={c.clientId} prospectId={c.prospectId} sites={sites}
            offres={offres.map((o) => ({ id: o.id, name: o.name, billing: o.billing, prix: activePromo(o)?.price ?? o.priceCents, setup: o.setupCents ?? 0, parentName: o.parent?.name ?? null }))}
            init={{ id: c.id, titre: c.titre, formule: c.formule, moyenPaiement: c.moyenPaiement, dureeMois: c.dureeMois, reconductionMois: c.reconductionMois, preavisJours: c.preavisJours, debutEngagement: c.debutEngagement ? c.debutEngagement.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }) : "", siteId: c.siteId, lignes: full.lignes.map((l) => ({ offerId: l.offerId, libelle: l.libelle, billing: l.billing, montantHt: l.montantHt, siteId: l.siteId, quantite: l.quantite })) }} />
        </>
      )}

      {validations.length > 0 && (
        <>
          <SectionTitle icon={ClipboardCheckIcon}>Validations</SectionTitle>
          <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
            {validations.map((v) => <li key={v.id} className="flex flex-wrap items-center gap-2 px-4 py-2"><Badge tone={v.statut === "VALIDEE" ? "green" : v.statut === "REFUSEE" ? "pink" : "yellow"}>{v.statut === "VALIDEE" ? "Validée" : v.statut === "REFUSEE" ? "Refusée" : "En attente"}</Badge><span className="text-title">{VALIDATION_LABEL[v.type]}</span><span className="text-xs text-text">· pour {teamName(v.assigne)}{v.decidePar ? ` · décidée par ${teamName(v.decidePar)} le ${v.decideAt ? fmtDayTime(v.decideAt) : ""}` : ""}{v.motif ? ` · ${v.motif}` : ""}{v.commentaire ? ` · ${v.commentaire}` : ""}</span></li>)}
          </ul>
        </>
      )}

      <SectionTitle icon={HistoryIcon}>Journal</SectionTitle>
      {journal.length === 0 ? <p className="text-sm text-text">Aucun événement.</p> : <ul className="divide-y divide-border rounded-card border border-border bg-surface text-xs">{journal.map((a) => <li key={a.id} className="px-4 py-2 text-text"><span className="text-title">{a.texte}</span> · {a.user ? teamName(a.user) : "système / client"} · {fmtDayTime(a.createdAt)}</li>)}</ul>}
      <p className="mt-4 text-[11px] text-muted">Statuts : brouillon → envoyé → consulté → signé (ou refusé) → terminé. Un contrat signé et son certificat sont immuables ; toute évolution passe par un avenant. Validité juridique de l’acceptation en ligne à faire vérifier.</p>
    </AdminPage>
  );
}
