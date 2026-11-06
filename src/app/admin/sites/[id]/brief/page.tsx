import { notFound } from "next/navigation";
import { ClipboardListIcon, PaperclipIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { requireSiteAcces } from "@/lib/perimetre";
import { can, estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { BRIEF_SECTIONS, ETAT_SECTION, chargerBrief, completude, lireContenu, sectionDe } from "@/lib/brief";
import { VALIDATION_LABEL } from "@/lib/validations";
import { fmtDayTime, teamName } from "@/lib/crm";
import { DemanderValidationButton, DerogationForm, PiecesBriefForm, SectionForm, SupprimerPieceButton } from "./form";
import { DocumentRow } from "@/components/documents/list";

export const metadata = { title: "Brief" };

/** Brief collaboratif (10.3) : sections avec état explicite, double validation commercial + Arsène, dérogation tracée. */
export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireTeam();
  const { id } = await params;
  await requireSiteAcces(me, id);
  const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true, clientId: true, client: { select: { name: true, commercial: { select: { firstName: true, email: true } } } } } });
  if (!site) notFound();
  const pieces = await prisma.document.findMany({ where: { siteId: id, kind: "BRIEF" }, orderBy: { createdAt: "desc" } });
  const [brief, validations] = await Promise.all([chargerBrief(id), prisma.validation.findMany({ where: { siteId: id, type: { in: ["BRIEF_COMMERCIAL", "BRIEF_TECHNIQUE"] } }, orderBy: { createdAt: "asc" }, include: { assigne: { select: { firstName: true, email: true } }, decidePar: { select: { firstName: true, email: true } } } })]);
  const contenu = lireContenu(brief.contenu);
  const c = completude(contenu, !!brief.derogationAt);
  const externe = estExterne(me);
  return (
    <AdminPage title={`Brief · ${site.name}`} back={{ href: `/admin/sites/${id}`, label: site.name }} action={<Badge tone={brief.etat === "VALIDE" ? "green" : brief.etat === "COMPLET" ? "blue" : brief.etat === "ATTENDU_CLIENT" ? "yellow" : "neutral"}>{brief.etat === "VALIDE" ? "Validé" : brief.etat === "COMPLET" ? "Complet, à valider" : brief.etat === "ATTENDU_CLIENT" ? "Attendu du client" : "En cours"}</Badge>}>
      <p className="-mt-3 text-sm text-text">{site.client.name} · référent {site.client.commercial ? teamName(site.client.commercial) : "personne"}. Le commercial remplit ce qu’il sait, le client complète depuis son portail ; chaque section passe par attendu → reçu → validé. La production ne démarre qu’après validation du commercial puis d’Arsène, et après le premier paiement (circuit distinct).</p>

      <div className="mt-4 rounded-card border border-border bg-surface p-4 text-sm">
        <p className="font-semibold text-title">{c.complet ? "Brief complet." : `${c.manquantes.length} section${c.manquantes.length > 1 ? "s" : ""} non validée${c.manquantes.length > 1 ? "s" : ""}${c.essentielles.length ? ` dont ${c.essentielles.length} essentielle${c.essentielles.length > 1 ? "s" : ""}` : ""}.`}</p>
        {brief.derogationAt && <p className="mt-1 text-xs text-violet">Dérogation d’Arsène le {fmtDayTime(brief.derogationAt)} : {brief.derogationNote}</p>}
        <ul className="mt-2 space-y-1 text-xs text-text">
          {validations.map((v) => <li key={v.id}><Badge tone={v.statut === "VALIDEE" ? "green" : v.statut === "REFUSEE" ? "pink" : "yellow"}>{v.statut === "VALIDEE" ? "Validée" : v.statut === "REFUSEE" ? "Refusée" : "En attente"}</Badge> {VALIDATION_LABEL[v.type]} · pour {teamName(v.assigne)}{v.decidePar ? ` · ${teamName(v.decidePar)} le ${v.decideAt ? fmtDayTime(v.decideAt) : ""}` : ""}{v.motif ? ` · ${v.motif}` : ""}</li>)}
          {validations.length === 0 && <li>Aucune validation demandée pour l’instant.</li>}
        </ul>
        {!externe && brief.etat !== "VALIDE" && (
          <div className="mt-3 space-y-3">
            <DemanderValidationButton siteId={id} />
            {can(me, "validation_technique") && !brief.derogationAt && c.essentielles.length === 0 && c.manquantes.length > 0 && <DerogationForm siteId={id} />}
          </div>
        )}
      </div>

      {/* Pièces jointes du brief : logos, textes, photos, cahier des charges… Internes à l'équipe, jamais montrées au client. */}
      <section className="mt-5 rounded-card border border-border bg-surface p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <PaperclipIcon size={14} className="text-text" aria-hidden />
          <p className="font-semibold text-title">Pièces jointes</p>
          <span className="text-xs text-text">{pieces.length === 0 ? "aucune pour l’instant" : `${pieces.length} fichier${pieces.length > 1 ? "s" : ""}`} · logos, textes, photos, cahier des charges, visibles de l’équipe seulement</span>
        </div>
        {pieces.length > 0 && <div className="mb-3 grid gap-2">{pieces.map((d) => <DocumentRow key={d.id} d={d} action={externe ? undefined : <SupprimerPieceButton siteId={id} docId={d.id} />} />)}</div>}
        {!externe && <PiecesBriefForm siteId={id} />}
      </section>

      <div className="mt-5 space-y-3">
        {BRIEF_SECTIONS.map((s) => {
          const sec = sectionDe(contenu, s.key);
          return (
            <section key={s.key} className="rounded-card border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <ClipboardListIcon size={14} className="text-text" aria-hidden />
                <p className="font-semibold text-title">{s.label}</p>
                {s.essentiel && <Badge tone="neutral">essentiel</Badge>}
                {s.client && <Badge tone="neutral">visible du client</Badge>}
                <Badge tone={ETAT_SECTION[sec.etat].tone}>{ETAT_SECTION[sec.etat].label}</Badge>
                {sec.majAt && <span className="ml-auto text-[11px] text-muted">{fmtDayTime(sec.majAt)}{sec.par ? ` · ${sec.par}` : ""}</span>}
              </div>
              <SectionForm siteId={id} sectionKey={s.key} texte={sec.texte} etat={sec.etat} aide={s.aide} />
            </section>
          );
        })}
      </div>
    </AdminPage>
  );
}
