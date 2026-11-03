import Link from "next/link";
import { FactoryIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHECKLIST_GO_LIVE, etatProduction } from "@/lib/production";
import { CHANGE_STATUS, stepLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { fmtDayTime, teamName } from "@/lib/crm";
import { VALIDATION_LABEL } from "@/lib/validations";
import { lienPdf } from "@/lib/contrats";
import { DemanderValidationMaquetteButton, EnvoyerMaquetteButton, GoLiveForm, ReceptionForm, RetoursCreation, VerifierButton } from "./prod-forms";
import { dernierRapportQA } from "@/lib/qa";

/** Bloc Production d'un site (10.3 à 10.7) : prérequis, validations, maquette, modifications par version, go-live, réception. */
export async function ProductionBloc({ siteId, externe }: { siteId: string; externe: boolean }) {
  const e = await etatProduction(siteId);
  const s = e.site;
  const [validations, modifs, receptionUrl, retours, rapport] = await Promise.all([
    prisma.validation.findMany({ where: { siteId, type: { in: ["MAQUETTE", "GO_LIVE", "BRIEF_COMMERCIAL", "BRIEF_TECHNIQUE"] } }, orderBy: { createdAt: "desc" }, take: 12, include: { assigne: { select: { firstName: true, email: true } }, decidePar: { select: { firstName: true, email: true } } } }),
    prisma.changeRequest.findMany({ where: { siteId }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, title: true, status: true, createdAt: true, completedAt: true, confirmedAt: true, assignee: { select: { firstName: true, email: true } } } }),
    lienPdf(s.receptionPath),
    prisma.retourCreation.findMany({ where: { siteId }, orderBy: [{ fait: "asc" }, { createdAt: "asc" }], select: { id: true, texte: true, page: true, fait: true, version: true } }),
    dernierRapportQA(siteId),
  ]);
  const enCreation = s.status === "EN_CREATION";
  return (
    <>
      <SectionTitle icon={FactoryIcon} action={<Link href={`/admin/sites/${siteId}/brief`} className="text-sm text-text hover:text-title">Brief</Link>}>Production · {enCreation ? `${stepLabel(s.projectStep)} · V${s.version}` : `livré${s.launchedAt ? ` le ${fmtDate(s.launchedAt)}` : ""}`}</SectionTitle>
      <Card className="space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Ligne ok={e.prod.ok} label="Premier paiement ou dérogation" detail={e.prod.ok ? "production autorisée" : e.prod.raison ?? ""} />
          <Ligne ok={e.briefOk} label="Brief validé (commercial puis Arsène)" detail={e.brief ? e.brief.etat.toLowerCase().replace("_", " ") : "non ouvert"} />
          <Ligne ok={e.docsManquants.length === 0} label="Éléments du client" detail={e.docsManquants.length ? `${e.docsManquants.length} manquant${e.docsManquants.length > 1 ? "s" : ""}` : "tout reçu"} />
          <Ligne ok={e.maquetteValidee} label="Maquette validée en interne (Bilel et Arsène)" detail={e.maquetteValidee ? "oui" : e.maquetteEnAttente ? "en attente" : "non demandée"} />
          <Ligne ok={!!s.maquetteEnvoyeeAt} label="Maquette envoyée au client" detail={s.maquetteEnvoyeeAt ? fmtDayTime(s.maquetteEnvoyeeAt) : "jamais (clic explicite requis)"} />
          <Ligne ok={!!s.goLiveAutoriseAt} label="Mise en ligne autorisée (Arsène)" detail={s.goLiveAutoriseAt ? fmtDayTime(s.goLiveAutoriseAt) : e.goLiveEnAttente ? "en attente" : "non demandée"} />
        </div>
        {e.actions.length > 0 && <ul className="space-y-0.5 text-sm text-blue">{e.actions.map((a, i) => <li key={i}>→ {a}</li>)}</ul>}
        {!externe && enCreation && (
          <div className="flex flex-wrap gap-2">
            {s.projectStep === "VALIDER_MAQUETTE" && !e.maquetteValidee && !e.maquetteEnAttente && <DemanderValidationMaquetteButton siteId={siteId} />}
            {e.maquetteValidee && !s.maquetteEnvoyeeAt && <EnvoyerMaquetteButton siteId={siteId} version={s.version} />}
          </div>
        )}
        {enCreation && s.projectStep === "A_LIVRER" && !s.goLiveAutoriseAt && !e.goLiveEnAttente && (
          <div className="border-t border-border pt-3"><p className="mb-2 text-sm font-semibold text-title">Checklist avant mise en ligne</p><GoLiveForm siteId={siteId} checklist={CHECKLIST_GO_LIVE} rapport={rapport} /></div>
        )}
        {enCreation && s.projectStep !== "A_LIVRER" && (s.previewUrl || s.url) && (
          <div className="border-t border-border pt-3"><p className="mb-2 text-sm font-semibold text-title">Vérification automatique du site</p><VerifierButton siteId={siteId} rapport={rapport} /></div>
        )}
        {validations.length > 0 && (
          <ul className="space-y-1 border-t border-border pt-3 text-xs text-text">
            {validations.map((v) => <li key={v.id}><Badge tone={v.statut === "VALIDEE" ? "green" : v.statut === "REFUSEE" ? "pink" : "yellow"}>{v.statut === "VALIDEE" ? "Validée" : v.statut === "REFUSEE" ? "Refusée" : "En attente"}</Badge> {VALIDATION_LABEL[v.type]} · {teamName(v.assigne)}{v.decideAt ? ` · ${fmtDayTime(v.decideAt)}` : ""}{v.motif ? ` · ${v.motif}` : ""}</li>)}
          </ul>
        )}
      </Card>

      {enCreation && (
        <>
          <SectionTitle>Retours de création · V{s.version} <span className="text-sm font-normal text-text">{retours.filter((r) => !r.fait).length} à faire</span></SectionTitle>
          <RetoursCreation siteId={siteId} retours={retours} version={s.version} etapeModifier={s.projectStep === "MODIFIER"} externe={externe} />
          <p className="mt-1 text-xs text-muted">Le client ne demande pas de modification depuis son portail tant que le site n’est pas en ligne : ses retours se notent ici, pendant les réunions.</p>
        </>
      )}
      {!enCreation && modifs.length > 0 && (
        <>
          <SectionTitle>Modifications après livraison ({modifs.length})</SectionTitle>
          <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
            {modifs.map((m) => <li key={m.id} className="flex items-center gap-2 px-4 py-2"><span className="min-w-0 flex-1 truncate text-title">{m.title}</span><span className="text-xs text-text">{fmtDate(m.createdAt)}{m.assignee ? ` · ${teamName(m.assignee)}` : ""}{m.completedAt ? ` · faite le ${fmtDate(m.completedAt)}` : ""}{m.confirmedAt ? " · confirmée par le client" : ""}</span><Badge tone={CHANGE_STATUS[m.status].tone}>{CHANGE_STATUS[m.status].label}</Badge></li>)}
          </ul>
          <p className="mt-1 text-xs text-muted">Crédit de modifications contractuel après livraison : traité selon l’offre (Essentiel : 2 allers-retours ; autres : 5 sur 24 mois, règles à confirmer).</p>
        </>
      )}

      {(s.projectStep === "A_LIVRER" || !enCreation) && !externe && (
        <>
          <SectionTitle>Réception de livraison</SectionTitle>
          <Card className="space-y-2">
            {s.receptionSigneeAt ? <p className="text-sm text-green">Réception signée le {fmtDate(s.receptionSigneeAt)}{receptionUrl ? <> · <a href={receptionUrl} target="_blank" rel="noreferrer" className="underline">ouvrir</a></> : null}</p> : <p className="text-sm text-text">Aucun document de réception archivé pour ce site (V{s.version}).</p>}
            <ReceptionForm siteId={siteId} />
          </Card>
        </>
      )}
    </>
  );
}

function Ligne({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return <p className="flex items-start gap-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-green" : "bg-pink"}`} aria-hidden /><span className="text-text-strong">{label}<span className="block text-xs text-text">{detail}</span></span></p>;
}
