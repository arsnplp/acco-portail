import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { can, estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/card";
import { CAMPAGNE_STATUT, MODELES, VARIABLES, apercu } from "@/lib/campagnes";
import { VALIDATION_LABEL } from "@/lib/validations";
import { fmtDayTime, teamName } from "@/lib/crm";
import { MODULES } from "@/lib/roles";
import { CampagneForm } from "../form";
import { AnnulerButton, LancerButton, ReprendreButton, TestForm, ValiderButton } from "./boutons";

const DEST = { EN_ATTENTE: ["En attente", "yellow"], ENVOYE: ["Envoyé", "green"], ERREUR: ["Erreur", "pink"], EXCLU: ["Exclu", "neutral"] } as const;

/** Fiche campagne : aperçu, test, validation humaine, lancement, suivi par destinataire. */
export default async function CampagnePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireTeam();
  if (estExterne(me)) redirect("/admin");
  const { id } = await params;
  const c = await prisma.campagne.findUnique({ where: { id }, include: { auteur: { select: { firstName: true, email: true } }, destinataires: { orderBy: { id: "asc" }, include: { client: { select: { id: true, name: true } } } } } });
  if (!c) notFound();
  const [a, validations, commerciaux] = await Promise.all([apercu(id), prisma.validation.findMany({ where: { objetId: id, type: "CAMPAGNE" }, orderBy: { createdAt: "desc" }, include: { assigne: { select: { firstName: true, email: true } }, decidePar: { select: { firstName: true, email: true } } } }), prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } })]);
  const n = (s: string) => c.destinataires.filter((d) => d.statut === s).length;
  return (
    <AdminPage title={<span className="flex items-center gap-2">{c.titre}<Badge tone={CAMPAGNE_STATUT[c.statut].tone}>{CAMPAGNE_STATUT[c.statut].label}</Badge></span>} back={{ href: "/admin/campagnes", label: "Campagnes" }} action={c.statut === "BROUILLON" || c.statut === "VALIDEE" || c.statut === "EN_COURS" ? <AnnulerButton id={id} /> : undefined}>
      <p className="-mt-3 text-sm text-text">{c.commercial ? "Message commercial" : "Message de service"} · plafond {c.plafond} · {c.auteur ? `par ${teamName(c.auteur)}` : ""} · {c.destinataires.length} destinataire{c.destinataires.length > 1 ? "s" : ""} : {n("ENVOYE")} envoyés, {n("EN_ATTENTE")} en attente, {n("ERREUR")} en erreur, {n("EXCLU")} exclus{c.envoiDebutAt ? ` · lancée le ${fmtDayTime(c.envoiDebutAt)}` : ""}{c.envoiFinAt ? ` · terminée le ${fmtDayTime(c.envoiFinAt)}` : ""}</p>

      <SectionTitle>Aperçu {a.email ? `(pour ${a.email})` : "(exemple)"}</SectionTitle>
      <div className="rounded-card border border-border bg-white p-4 text-black"><p className="mb-2 border-b border-zinc-200 pb-2 text-sm font-semibold">{a.objet}</p><div dangerouslySetInnerHTML={{ __html: a.html }} /></div>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <TestForm id={id} defaut={me.email} />
        {c.statut === "BROUILLON" && validations.every((v) => v.statut !== "EN_ATTENTE") && <ValiderButton id={id} />}
        {c.statut === "VALIDEE" && can(me, "campagnes") && <LancerButton id={id} n={n("EN_ATTENTE")} />}
        {(c.statut === "TERMINEE" || c.statut === "EN_COURS") && n("ERREUR") > 0 && can(me, "campagnes") && <ReprendreButton id={id} />}
      </div>
      {validations.length > 0 && <ul className="mt-3 space-y-1 text-xs text-text">{validations.map((v) => <li key={v.id}><Badge tone={v.statut === "VALIDEE" ? "green" : v.statut === "REFUSEE" ? "pink" : "yellow"}>{v.statut === "VALIDEE" ? "Validée" : v.statut === "REFUSEE" ? "Refusée" : "En attente"}</Badge> {VALIDATION_LABEL[v.type]} · pour {teamName(v.assigne)}{v.decidePar ? ` · ${teamName(v.decidePar)} le ${v.decideAt ? fmtDayTime(v.decideAt) : ""}` : ""}{v.motif ? ` · ${v.motif}` : ""}</li>)}</ul>}

      <SectionTitle>Destinataires ({c.destinataires.length})</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
        {c.destinataires.map((d) => <li key={d.id} className="flex items-center gap-2 px-4 py-2"><Link href={`/admin/clients/${d.client.id}`} className="min-w-0 flex-1 truncate text-title hover:underline">{d.client.name} <span className="text-xs text-text">· {d.email}</span></Link><span className="text-xs text-text">{d.envoyeAt ? fmtDayTime(d.envoyeAt) : d.erreur ?? ""}</span><Badge tone={DEST[d.statut][1]}>{DEST[d.statut][0]}</Badge></li>)}
        {c.destinataires.length === 0 && <li className="px-4 py-2 text-text">Aucun destinataire.</li>}
      </ul>

      {c.statut === "BROUILLON" && (<><SectionTitle>Modifier</SectionTitle><CampagneForm init={{ id: c.id, titre: c.titre, objet: c.objet, corpsHtml: c.corpsHtml, commercial: c.commercial, plafond: c.plafond }} modeles={MODELES} commerciaux={commerciaux.map((u) => ({ id: u.id, name: teamName(u) }))} variables={VARIABLES} /></>)}
    </AdminPage>
  );
}
