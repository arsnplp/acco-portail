"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { nouvelleReference, premierPaiementRecu, signalerImpaye, creerAvenant, convertirEnClient, demanderDerogationPaiement, envoyerContrat, genererPdf } from "@/lib/contrats";
import { logActivite } from "@/lib/activite";
import { estExterne } from "@/lib/permissions";
import { demanderValidation } from "@/lib/validations";
import { uploadFile } from "@/lib/storage";
import { activePromo } from "@/lib/offers";

const rafraichir = (clientId: string | null, contratId: string) => { if (clientId) revalidatePath(`/admin/clients/${clientId}`); revalidatePath(`/admin/contrats/${contratId}`); revalidatePath("/admin/contrats"); };

/** « Premier paiement reçu » (00.10) : saisie manuelle, droit finance. */
export async function marquerPremierPaiement(contratId: string, annuler = false) {
  const me = await requireTeam();
  if (!can(me, "finance")) return;
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true } });
  if (!c) return;
  await premierPaiementRecu(contratId, me.id, annuler);
  rafraichir(c.clientId, contratId);
}
/** « Impayé » signalé ou régularisé (00.10) : alerte interne seulement, jamais le client. */
export async function marquerImpaye(contratId: string, regularise = false) {
  const me = await requireTeam();
  if (!can(me, "finance")) return;
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true } });
  if (!c) return;
  await signalerImpaye(contratId, me.id, regularise);
  rafraichir(c.clientId, contratId);
}

/**
 * « À proposer » pour un site précis (4.4) : crée un contrat brouillon (nouveau contrat ou avenant si le site a déjà un
 * contrat signé) avec une ligne ciblant ce site. Jamais de changement de facturation silencieux.
 */
export async function proposerPourSite(clientId: string, siteId: string, offerId: string) {
  const me = await requireTeam();
  if (estExterne(me)) return;
  const [client, site, offer] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, commercialId: true, name: true } }),
    prisma.site.findFirst({ where: { id: siteId, clientId }, select: { id: true, name: true, contratId: true } }),
    prisma.offer.findUnique({ where: { id: offerId }, include: { promotions: true } }),
  ]);
  if (!client || !site || !offer) return;
  const prix = activePromo(offer)?.price ?? offer.priceCents;
  const setup = offer.setupCents ?? 0;
  const base = site.contratId ? await prisma.contrat.findUnique({ where: { id: site.contratId }, select: { id: true, statut: true, version: true, dureeMois: true, reconductionMois: true, preavisJours: true, formule: true, moyenPaiement: true } }) : null;
  const parent = base?.statut === "SIGNE" ? base : null;
  const contrat = await prisma.contrat.create({
    data: {
      reference: await nouvelleReference(), clientId, siteId, parentId: parent?.id ?? null, version: parent ? parent.version + 1 : 1,
      titre: parent ? `Avenant : ${offer.name} pour ${site.name}` : `${offer.name} pour ${site.name}`,
      formule: parent?.formule ?? null, moyenPaiement: parent?.moyenPaiement ?? null,
      dureeMois: parent?.dureeMois ?? (offer.billing === "MENSUEL" ? 12 : 0), reconductionMois: parent?.reconductionMois ?? 12, preavisJours: parent?.preavisJours ?? 30,
      montantMensuelHt: offer.billing === "MENSUEL" ? prix : 0, montantPonctuelHt: offer.billing === "MENSUEL" ? setup : prix,
      commercialId: client.commercialId ?? me.id, createdById: me.id,
      lignes: { create: [{ offerId: offer.id, siteId, libelle: offer.name, billing: offer.billing, montantHt: prix, ordre: 0 }, ...(offer.billing === "MENSUEL" && setup ? [{ offerId: offer.id, siteId, libelle: `${offer.name} : mise en place`, billing: "PONCTUEL" as const, montantHt: setup, ordre: 1 }] : [])] },
    },
  });
  await logActivite({ kind: "contrat", texte: `Proposition préparée : ${offer.name} pour ${site.name} (${contrat.reference}, brouillon)`, href: `/admin/contrats/${contrat.id}`, userId: me.id, clientId, siteId });
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/contrats/${contrat.id}`);
}

// ─── Générateur commun (5.1) : création et modification d'un brouillon ─────────────────

export type ContratState = { error?: string; ok?: string };
type LigneSaisie = { offerId?: string | null; libelle: string; billing: "MENSUEL" | "PONCTUEL"; montantHt: number; siteId?: string | null; quantite?: number };
const MOYENS = ["SEPA", "CARTE", "VIREMENT", "LIEN", "AUTRE"] as const;
const FORMULES = ["ESSENTIEL", "REFERENCE", "CONQUETE", "SIGNATURE"] as const;

function lireLignes(raw: string): LigneSaisie[] {
  try {
    const arr = JSON.parse(raw) as Partial<LigneSaisie>[];
    return arr.filter((l) => l && (l.libelle ?? "").trim()).map((l) => ({ offerId: l.offerId || null, libelle: String(l.libelle).trim().slice(0, 200), billing: l.billing === "PONCTUEL" ? "PONCTUEL" : "MENSUEL", montantHt: Math.max(0, Math.round(Number(l.montantHt) || 0)), siteId: l.siteId || null, quantite: Math.max(1, Math.round(Number(l.quantite) || 1)) }));
  } catch { return []; }
}
function lireChamps(fd: FormData) {
  const d = Object.fromEntries(fd) as Record<string, string>;
  const lignes = lireLignes(d.lignes ?? "[]");
  const dureeMois = Math.max(0, parseInt(d.dureeMois || "24", 10) || 0);
  const debut = d.debutEngagement ? new Date(`${d.debutEngagement}T12:00:00`) : null;
  const fin = debut && dureeMois ? new Date(new Date(debut).setMonth(debut.getMonth() + dureeMois)) : null;
  return {
    titre: (d.titre ?? "").trim().slice(0, 160), formule: FORMULES.includes(d.formule as (typeof FORMULES)[number]) ? (d.formule as (typeof FORMULES)[number]) : null,
    moyenPaiement: MOYENS.includes(d.moyenPaiement as (typeof MOYENS)[number]) ? (d.moyenPaiement as (typeof MOYENS)[number]) : null,
    dureeMois, reconductionMois: Math.max(0, parseInt(d.reconductionMois || "24", 10) || 0), preavisJours: Math.max(0, parseInt(d.preavisJours || "30", 10) || 0),
    debutEngagement: debut, finEngagement: fin, siteId: d.siteId || null, lignes,
    montantMensuelHt: lignes.filter((l) => l.billing === "MENSUEL").reduce((a, l) => a + l.montantHt * (l.quantite ?? 1), 0),
    montantPonctuelHt: lignes.filter((l) => l.billing === "PONCTUEL").reduce((a, l) => a + l.montantHt * (l.quantite ?? 1), 0),
  };
}
/** Exception tarifaire (5.3, 20.1) : une ligne du catalogue vendue sous son prix demande la validation de Bilel ou Lucas. */
async function detecterRemise(lignes: LigneSaisie[]) {
  const ids = lignes.map((l) => l.offerId).filter((x): x is string => !!x);
  if (ids.length === 0) return [] as string[];
  const offres = await prisma.offer.findMany({ where: { id: { in: ids } }, include: { promotions: true } });
  return lignes.filter((l) => { const o = offres.find((x) => x.id === l.offerId); return o && l.montantHt < (activePromo(o)?.price ?? o.priceCents); }).map((l) => l.libelle);
}

export async function creerContrat(_prev: ContratState, fd: FormData): Promise<ContratState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe commerciale." };
  const d = lireChamps(fd);
  const prospectId = String(fd.get("prospectId") ?? "") || null, clientId = String(fd.get("clientId") ?? "") || null;
  if (!prospectId && !clientId) return { error: "Contrat sans prospect ni client." };
  if (!d.titre) return { error: "Donnez un titre au contrat." };
  if (d.lignes.length === 0) return { error: "Ajoutez au moins une ligne de prestation." };
  const [prospect, client] = await Promise.all([prospectId ? prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true, commercialId: true, clientId: true } }) : null, clientId ? prisma.client.findUnique({ where: { id: clientId }, select: { id: true, commercialId: true } }) : null]);
  if ((prospectId && !prospect) || (clientId && !client)) return { error: "Fiche introuvable." };
  if (d.siteId && !(await prisma.site.findFirst({ where: { id: d.siteId, clientId: clientId ?? prospect?.clientId ?? "" } }))) return { error: "Site introuvable sur cette fiche." };
  const remises = await detecterRemise(d.lignes);
  const contrat = await prisma.contrat.create({ data: {
    reference: await nouvelleReference(), prospectId, clientId: clientId ?? prospect?.clientId ?? null, siteId: d.siteId, titre: d.titre, formule: d.formule, moyenPaiement: d.moyenPaiement,
    dureeMois: d.dureeMois, reconductionMois: d.reconductionMois, preavisJours: d.preavisJours, debutEngagement: d.debutEngagement, finEngagement: d.finEngagement,
    montantMensuelHt: d.montantMensuelHt, montantPonctuelHt: d.montantPonctuelHt, commercialId: client?.commercialId ?? prospect?.commercialId ?? me.id, createdById: me.id,
    lignes: { create: d.lignes.map((l, i) => ({ offerId: l.offerId, siteId: l.siteId, libelle: l.libelle, billing: l.billing, montantHt: l.montantHt, quantite: l.quantite ?? 1, ordre: i })) },
  } });
  if (remises.length && !can(me, "validation_commerciale")) await demanderValidation({ type: "EXCEPTION_TARIFAIRE", contratId: contrat.id, clientId: contrat.clientId, demandeParId: me.id, commentaire: `${contrat.reference} : prix sous le catalogue (${remises.join(", ")})`, href: `/admin/contrats/${contrat.id}` });
  await logActivite({ kind: "contrat", texte: `Contrat ${contrat.reference} créé (brouillon)`, href: `/admin/contrats/${contrat.id}`, userId: me.id, clientId: contrat.clientId, siteId: contrat.siteId });
  if (prospectId) revalidatePath(`/crm/prospects/${prospectId}`);
  rafraichir(contrat.clientId, contrat.id);
  redirect(`/admin/contrats/${contrat.id}`);
}

export async function modifierContrat(contratId: string, _prev: ContratState, fd: FormData): Promise<ContratState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe commerciale." };
  const c = await prisma.contrat.findUnique({ where: { id: contratId } });
  if (!c) return { error: "Contrat introuvable." };
  if (c.statut !== "BROUILLON") return { error: "Seul un brouillon se modifie : un contrat envoyé se renvoie en nouvelle version, un contrat signé reçoit un avenant." };
  const d = lireChamps(fd);
  if (!d.titre) return { error: "Donnez un titre au contrat." };
  if (d.lignes.length === 0) return { error: "Ajoutez au moins une ligne de prestation." };
  const remises = await detecterRemise(d.lignes);
  await prisma.$transaction([
    prisma.ligneContrat.deleteMany({ where: { contratId } }),
    prisma.contrat.update({ where: { id: contratId }, data: {
      siteId: d.siteId, titre: d.titre, formule: d.formule, moyenPaiement: d.moyenPaiement, dureeMois: d.dureeMois, reconductionMois: d.reconductionMois, preavisJours: d.preavisJours,
      debutEngagement: d.debutEngagement, finEngagement: d.finEngagement, montantMensuelHt: d.montantMensuelHt, montantPonctuelHt: d.montantPonctuelHt, pdfPath: null, pdfSha256: null, majFinanciereAt: new Date(),
      lignes: { create: d.lignes.map((l, i) => ({ offerId: l.offerId, siteId: l.siteId, libelle: l.libelle, billing: l.billing, montantHt: l.montantHt, quantite: l.quantite ?? 1, ordre: i })) },
    } }),
  ]);
  if (remises.length && !can(me, "validation_commerciale")) await demanderValidation({ type: "EXCEPTION_TARIFAIRE", contratId, clientId: c.clientId, demandeParId: me.id, commentaire: `${c.reference} : prix sous le catalogue (${remises.join(", ")})`, href: `/admin/contrats/${contratId}` });
  await logActivite({ kind: "contrat", texte: `Contrat ${c.reference} modifié (brouillon)`, href: `/admin/contrats/${contratId}`, userId: me.id, clientId: c.clientId });
  rafraichir(c.clientId, contratId);
  return { ok: "Brouillon enregistré." };
}

export async function genererPdfAction(contratId: string): Promise<ContratState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe." };
  try { await genererPdf(contratId); } catch (e) { return { error: (e as Error).message }; }
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true } });
  rafraichir(c?.clientId ?? null, contratId);
  return { ok: "PDF généré." };
}

/** Envoi (ou relance : toujours sur clic humain, 5.2 F) par Gmail avec lien d'acceptation. Bloqué tant qu'une exception tarifaire n'est pas validée. */
export async function envoyerContratAction(contratId: string, _prev: ContratState, fd: FormData): Promise<ContratState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe." };
  const exception = await prisma.validation.findFirst({ where: { contratId, type: "EXCEPTION_TARIFAIRE", statut: { in: ["EN_ATTENTE", "REFUSEE"] } } });
  if (exception) return { error: exception.statut === "REFUSEE" ? "Exception tarifaire refusée : corrigez les prix." : "Exception tarifaire en attente de validation (Bilel ou Lucas)." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const nom = String(fd.get("nom") ?? "").trim();
  const r = await envoyerContrat(contratId, me.id, email ? { nom, email } : null);
  if (!r.ok) return { error: r.error };
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true, prospectId: true } });
  if (c?.prospectId) revalidatePath(`/crm/prospects/${c.prospectId}`);
  rafraichir(c?.clientId ?? null, contratId);
  return { ok: `Envoyé à ${r.email}.` };
}

/** Alternative 00.5 : PDF signé à la main et scanné. Le contrat passe signé et la conversion s'exécute (idempotente). */
export async function deposerScan(contratId: string, _prev: ContratState, fd: FormData): Promise<ContratState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe." };
  const c = await prisma.contrat.findUnique({ where: { id: contratId } });
  if (!c) return { error: "Contrat introuvable." };
  if (c.statut === "SIGNE" || c.statut === "TERMINE") return { error: "Ce contrat est déjà signé." };
  const file = fd.get("scan");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez le PDF ou l’image du contrat signé." };
  if (!/^(application\/pdf|image\/)/.test(file.type)) return { error: "PDF ou image uniquement." };
  const nom = String(fd.get("nom") ?? "").trim();
  if (!nom) return { error: "Indiquez le nom du signataire." };
  let path: string;
  try { path = await uploadFile("documents", `contrats/${c.id}`, file); } catch (e) { return { error: (e as Error).message }; }
  if (!c.pdfPath) { try { await genererPdf(contratId); } catch { /* le scan fait foi */ } }
  const signeAt = fd.get("date") ? new Date(`${fd.get("date")}T12:00:00`) : new Date();
  await prisma.contrat.update({ where: { id: contratId }, data: { statut: "SIGNE", signeAt, scanPath: path, signataireNom: nom, otpHash: null, otpExpiresAt: null } });
  const conv = await convertirEnClient(contratId);
  await logActivite({ kind: "contrat", texte: `Contrat ${c.reference} signé à la main (scan déposé) par ${nom}`, href: `/admin/contrats/${contratId}`, userId: me.id, clientId: conv.clientId, siteId: c.siteId });
  if (c.prospectId) revalidatePath(`/crm/prospects/${c.prospectId}`);
  rafraichir(conv.clientId, contratId);
  return { ok: `Contrat signé et rattaché à la fiche client${conv.cree ? " (fiche créée)" : ""}.` };
}

export async function creerAvenantAction(contratId: string) {
  const me = await requireTeam();
  if (estExterne(me)) return;
  const a = await creerAvenant(contratId, me.id);
  rafraichir(a.clientId, contratId);
  redirect(`/admin/contrats/${a.id}`);
}

export async function demanderDerogation(contratId: string, _prev: ContratState, fd: FormData): Promise<ContratState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe." };
  const motif = String(fd.get("motif") ?? "").trim();
  if (!motif) return { error: "Justifiez la dérogation." };
  const n = await demanderDerogationPaiement(contratId, me.id, motif);
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true } });
  rafraichir(c?.clientId ?? null, contratId);
  return n ? { ok: "Dérogation demandée : exception commerciale (Bilel ou Lucas), puis accord d’Arsène." } : { ok: "Une demande est déjà en attente." };
}

/** Clôture d'un contrat signé arrivé à son terme (archivage, jamais de suppression) ; suppression d'un brouillon seulement. */
export async function cloreContrat(contratId: string) {
  const me = await requireTeam();
  if (!can(me, "archiver")) return;
  const c = await prisma.contrat.findUnique({ where: { id: contratId } });
  if (!c) return;
  if (c.statut === "BROUILLON") {
    await prisma.contrat.delete({ where: { id: contratId } });
    await logActivite({ kind: "contrat", texte: `Brouillon ${c.reference} supprimé`, userId: me.id, clientId: c.clientId });
    rafraichir(c.clientId, contratId);
    redirect(c.clientId ? `/admin/clients/${c.clientId}?onglet=contrats` : "/admin/contrats");
  }
  await prisma.contrat.update({ where: { id: contratId }, data: { statut: "TERMINE" } });
  await prisma.subscription.updateMany({ where: { contratId, status: "ACTIF" }, data: { status: "RESILIE", cancelledAt: new Date() } });
  await logActivite({ kind: "contrat", texte: `Contrat ${c.reference} terminé (archivé)`, href: `/admin/contrats/${contratId}`, userId: me.id, clientId: c.clientId });
  rafraichir(c.clientId, contratId);
}
