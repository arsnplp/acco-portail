import Link from "next/link";
import { FileTextIcon, FolderOpenIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { CONTRAT_STATUT } from "@/lib/contrats";
import type { Ctx } from "./ctx";

const KIND = { CONTRAT: "Contrat", DEVIS: "Devis", AUTRE: "Document", FACTURE: "Facture", BRIEF: "Pièce du brief" } as const;

/** Onglet Documents (4.3, 00.10) : contrats signés, devis, briefs, pièces déposées et attendues, réception signée. Pas de factures (Pennylane). */
export async function DocumentsOnglet({ clientId, externe }: Ctx) {
  const [docs, attendus, contrats, sites] = await Promise.all([
    prisma.document.findMany({ where: { clientId, kind: { not: "FACTURE" } }, orderBy: { createdAt: "desc" }, include: { site: { select: { name: true } } } }),
    prisma.documentRequest.findMany({ where: { clientId, status: "EN_ATTENTE" }, orderBy: { createdAt: "desc" }, include: { site: { select: { name: true } }, requester: { select: { firstName: true, email: true } } } }),
    externe ? [] : prisma.contrat.findMany({ where: { clientId, OR: [{ pdfPath: { not: null } }, { scanPath: { not: null } }] }, orderBy: { createdAt: "desc" }, select: { id: true, reference: true, statut: true, signeAt: true, scanPath: true, certificatPath: true } }),
    prisma.site.findMany({ where: { clientId }, select: { id: true, name: true, receptionSigneeAt: true, brief: { select: { etat: true, updatedAt: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <Card href={`/admin/clients/${clientId}/documents`} className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-3"><FolderOpenIcon size={20} strokeWidth={1.5} className="text-text" /><div><p className="font-medium text-title">Espace documents</p><p className="text-xs text-text">Déposer, demander au client, télécharger</p></div></div><span className="text-sm text-text">Ouvrir →</span></Card>
      {attendus.length > 0 && (
        <>
          <SectionTitle>Attendus du client ({attendus.length})</SectionTitle>
          <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">{attendus.map((d) => <li key={d.id} className="px-4 py-2"><p className="text-title">{KIND[d.kind]}{d.site ? ` · ${d.site.name}` : ""}{d.message ? ` · ${d.message}` : ""}</p><p className="text-xs text-text">Demandé le {fmtDate(d.createdAt)}{d.requester ? ` par ${d.requester.firstName ?? d.requester.email}` : ""} · {d.direction === "VERS_CLIENT" ? "à fournir par le client" : "à fournir par l’équipe"}</p></li>)}</ul>
        </>
      )}
      {!externe && (
        <>
          <SectionTitle icon={FileTextIcon}>Contrats et preuves</SectionTitle>
          {contrats.length === 0 ? <p className="text-sm text-text">Aucun contrat généré.</p> : <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">{contrats.map((c) => <li key={c.id} className="flex items-center gap-2 px-4 py-2"><Link href={`/admin/contrats/${c.id}`} className="flex-1 text-title hover:underline">{c.reference}</Link><Badge tone={CONTRAT_STATUT[c.statut].tone}>{CONTRAT_STATUT[c.statut].label}</Badge><span className="text-xs text-text">{c.signeAt ? `signé le ${fmtDate(c.signeAt)}` : ""}{c.certificatPath ? " · certificat" : ""}{c.scanPath ? " · scan" : ""}</span></li>)}</ul>}
        </>
      )}
      <SectionTitle>Briefs et réceptions</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
        {sites.map((s) => <li key={s.id} className="px-4 py-2"><Link href={`/admin/sites/${s.id}`} className="text-title hover:underline">{s.name}</Link><span className="ml-2 text-xs text-text">brief : {s.brief ? `${s.brief.etat.toLowerCase().replace("_", " ")} (${fmtDate(s.brief.updatedAt)})` : "non commencé"} · réception : {s.receptionSigneeAt ? `signée le ${fmtDate(s.receptionSigneeAt)}` : "non signée"}</span></li>)}
        {sites.length === 0 && <li className="px-4 py-2 text-text">Aucun site.</li>}
      </ul>
      <SectionTitle>Pièces ({docs.length})</SectionTitle>
      {docs.length === 0 ? <p className="text-sm text-text">Aucune pièce.</p> : <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">{docs.map((d) => <li key={d.id} className="px-4 py-2"><p className="text-title">{d.title} <span className="text-xs text-text">· {KIND[d.kind]}{d.site ? ` · ${d.site.name}` : ""} · {fmtDate(d.createdAt)}{d.uploadedByClient ? " · déposé par le client" : ""}</span></p></li>)}</ul>}
    </div>
  );
}
