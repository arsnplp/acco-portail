/**
 * Un prospect passé « Gagné » devient un client du portail tout de suite (sans attendre le contrat) : fiche client, fil de
 * conversation, site en création avec son brief, contacts rattachés. Aucun compte de connexion ni email : l'invitation se fait
 * plus tard, à la main. Rapprochement contrôlé avec un client existant (même SIREN, même téléphone ou même nom) : pas de doublon.
 */
import { prisma } from "@/lib/prisma";
import { normName, normPhone } from "@/lib/crm";
import { logActivite } from "@/lib/activite";

export async function clientDepuisProspect(prospectId: string, userId?: string | null): Promise<{ clientId: string; cree: boolean } | null> {
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, include: { contacts: true } });
  if (!p) return null;
  if (p.clientId) return { clientId: p.clientId, cree: false };
  const candidats = await prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, siren: true, phone: true } });
  const existant = candidats.find((x) => (p.siren && x.siren && x.siren.replace(/\s/g, "") === p.siren.replace(/\s/g, "")) || (p.telephone && normPhone(x.phone) && normPhone(x.phone) === normPhone(p.telephone)) || normName(x.name) === normName(p.societe));
  let clientId = existant?.id ?? null, cree = false;
  if (!clientId) {
    const principal = p.contacts.find((x) => x.principal) ?? p.contacts[0];
    const client = await prisma.client.create({ data: { name: p.societe, siren: p.siren, address: p.adresse, phone: p.telephone, email: principal?.email ?? null, commercialId: p.commercialId, engagementDebut: p.gagneAt ?? new Date(), conversation: { create: {} } } });
    clientId = client.id; cree = true;
    // Un site en création, avec son brief, pour que la production puisse démarrer dès le contrat et le premier paiement.
    const host = p.siteWeb ? p.siteWeb.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") : null;
    await prisma.site.create({ data: { clientId, name: host ?? p.societe, url: null, status: "EN_CREATION", projectStep: "CREER_MAQUETTE", developpeurId: null, brief: { create: { etat: "EN_COURS" } }, assets: { create: [{ kind: "LOGO", label: "Votre logo" }, { kind: "TEXTE", label: "Textes de présentation" }, { kind: "PHOTO", label: "Photos" }] } } });
  }
  await prisma.$transaction([
    prisma.prospect.update({ where: { id: prospectId }, data: { clientId, statut: "GAGNE", gagneAt: p.gagneAt ?? new Date() } }),
    prisma.prospectContact.updateMany({ where: { prospectId, clientId: null }, data: { clientId } }),
  ]);
  await logActivite({ kind: "conversion", texte: cree ? `${p.societe} gagné : fiche client créée` : `${p.societe} gagné : rattaché à la fiche client existante`, href: `/admin/clients/${clientId}`, clientId, userId: userId ?? p.commercialId });
  return { clientId, cree };
}
