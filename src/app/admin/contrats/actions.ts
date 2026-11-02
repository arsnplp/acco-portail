"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { nouvelleReference, premierPaiementRecu, signalerImpaye } from "@/lib/contrats";
import { logActivite } from "@/lib/activite";

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
  const [client, site, offer] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, commercialId: true, name: true } }),
    prisma.site.findFirst({ where: { id: siteId, clientId }, select: { id: true, name: true, contratId: true } }),
    prisma.offer.findUnique({ where: { id: offerId }, include: { promotions: true } }),
  ]);
  if (!client || !site || !offer) return;
  const { activePromo } = await import("@/lib/offers");
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
