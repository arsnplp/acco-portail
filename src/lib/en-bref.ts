/**
 * « En bref » (4.2 bloc 10, sans IA) : phrases calculées à partir des objets réels du client — activité, relation,
 * alertes et opportunités. Sert aussi de matière à la synthèse IA sur clic.
 */
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtPrice } from "@/lib/format";
import { JOURS_SANS_CONTACT } from "@/lib/alertes";
import { timelineClient, CANAUX_CONTACT } from "@/lib/timeline";
import { stepLabel } from "@/lib/labels";
import { CONTRAT_STATUT } from "@/lib/contrats";

export async function enBref(clientId: string, opts: { finance?: boolean } = {}) {
  const finance = opts.finance ?? true;
  const now = new Date();
  const [client, contacts, taches, rdvAVenir, docsAttendus, commandes, modifs, offres] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, include: { sites: { include: { subscriptions: { where: { status: "ACTIF" }, select: { label: true, module: true, offerId: true } } } }, contrats: { orderBy: { createdAt: "desc" } }, subscriptions: { where: { status: "ACTIF" } }, commercial: { select: { firstName: true, email: true } }, referralsMade: { select: { status: true } } } }),
    timelineClient(clientId, { canaux: CANAUX_CONTACT, limite: 8 }),
    prisma.tacheClient.findMany({ where: { clientId, statut: "A_FAIRE" }, select: { titre: true, echeance: true, type: true } }),
    prisma.rendezVous.count({ where: { clientId, resultat: "PREVU", debut: { gte: now } } }),
    prisma.documentRequest.count({ where: { clientId, status: "EN_ATTENTE", direction: "VERS_CLIENT" } }),
    prisma.order.count({ where: { clientId, status: "A_TRAITER" } }),
    prisma.changeRequest.count({ where: { site: { clientId }, status: { in: ["RECUE", "A_VALIDER"] } } }),
    prisma.offer.findMany({ where: { isArchived: false }, select: { id: true, name: true, parentId: true, module: true } }),
  ]);
  const faits: string[] = [];
  const alertes: string[] = [];
  const opportunites: string[] = [];
  const mrr = client.subscriptions.filter((s) => s.billing === "MENSUEL").reduce((a, s) => a + s.priceCents, 0);
  const anciennete = Math.floor((now.getTime() - client.createdAt.getTime()) / 86400_000);
  faits.push(`Client depuis le ${fmtDate(client.createdAt)} (${anciennete < 60 ? `${anciennete} jours` : `${Math.round(anciennete / 30)} mois`})${client.secteur ? `, secteur ${client.secteur}` : ""}.`);
  faits.push(`${client.sites.length} site${client.sites.length > 1 ? "s" : ""}${client.sites.length ? " : " + client.sites.map((s) => `${s.name} (${s.status === "EN_LIGNE" ? "en ligne" : s.status === "EN_CREATION" ? stepLabel(s.projectStep) : "suspendu"})`).join(", ") : ""}.`);
  const signes = client.contrats.filter((c) => c.statut === "SIGNE");
  faits.push(`${client.contrats.length} contrat${client.contrats.length > 1 ? "s" : ""}${signes.length ? `, ${signes.length} signé${signes.length > 1 ? "s" : ""}` : ""} · ${client.subscriptions.length} abonnement${client.subscriptions.length > 1 ? "s" : ""} actif${client.subscriptions.length > 1 ? "s" : ""}${finance && mrr ? ` · ${fmtPrice(mrr)} HT / mois` : ""}.`);
  faits.push(`Référent : ${client.commercial ? client.commercial.firstName ?? client.commercial.email : "personne"}.`);
  const dernier = contacts.find((c) => c.date <= now);
  const jours = dernier ? Math.floor((now.getTime() - dernier.date.getTime()) / 86400_000) : null;
  faits.push(dernier ? `Dernier contact il y a ${jours} jour${jours! > 1 ? "s" : ""} (${dernier.titre}).` : "Aucun contact tracé (email, appel, RDV ou compte rendu).");
  if ((jours === null || jours >= JOURS_SANS_CONTACT) && rdvAVenir === 0) alertes.push(`Aucun échange depuis ${jours === null ? "le début" : `${jours} jours`} et pas de RDV prévu.`);
  const enRetard = taches.filter((t) => t.echeance && t.echeance < now);
  if (enRetard.length) alertes.push(`${enRetard.length} tâche${enRetard.length > 1 ? "s" : ""} en retard : ${enRetard.slice(0, 3).map((t) => t.titre).join(", ")}.`);
  if (taches.some((t) => t.type === "RDV_A_PLANIFIER")) alertes.push("Un rendez-vous est à planifier.");
  if (docsAttendus) alertes.push(`${docsAttendus} document${docsAttendus > 1 ? "s" : ""} attendu${docsAttendus > 1 ? "s" : ""} du client.`);
  if (commandes) alertes.push(`${commandes} commande${commandes > 1 ? "s" : ""} depuis le portail à traiter.`);
  if (modifs) alertes.push(`${modifs} demande${modifs > 1 ? "s" : ""} de modification en attente.`);
  for (const c of client.contrats) {
    if (c.statut === "ENVOYE" || c.statut === "CONSULTE") alertes.push(`Contrat ${c.reference} ${CONTRAT_STATUT[c.statut].label.toLowerCase()}, non signé.`);
    if (finance && c.statut === "SIGNE" && !c.premierPaiementAt) alertes.push(`Contrat ${c.reference} signé : premier paiement non reçu.`);
    if (finance && c.impayeAt && !c.regulariseAt) alertes.push(`Impayé signalé sur ${c.reference} depuis le ${fmtDate(c.impayeAt)}.`);
    if (c.statut === "SIGNE" && c.finEngagement && c.finEngagement.getTime() - now.getTime() < 90 * 86400_000 && c.finEngagement > now) alertes.push(`Engagement ${c.reference} se termine le ${fmtDate(c.finEngagement)} : renouvellement à préparer.`);
  }
  // Opportunités : options du catalogue absentes d'un site précis (jamais une option déjà active sur ce site).
  for (const s of client.sites) {
    const actives = new Set(s.subscriptions.map((x) => x.offerId).filter(Boolean));
    const manquantes = offres.filter((o) => o.parentId && !actives.has(o.id) && s.status === "EN_LIGNE").map((o) => o.name);
    if (manquantes.length) opportunites.push(`${s.name} : ${manquantes.slice(0, 3).join(", ")} non souscrit${manquantes.length > 1 ? "s" : ""}.`);
  }
  if (client.referralsMade.length) faits.push(`${client.referralsMade.length} parrainage${client.referralsMade.length > 1 ? "s" : ""} envoyé${client.referralsMade.length > 1 ? "s" : ""}.`);
  else if (client.sites.some((s) => s.status === "EN_LIGNE") && jours !== null && jours < 30) opportunites.push("Client en relation récente et site en ligne : moment propice pour demander un parrainage ou un avis.");
  const dernieres = contacts.slice(0, 5).map((c) => `${fmtDate(c.date)} · ${c.titre}${c.auteur ? ` (${c.auteur})` : ""}`);
  return { faits, alertes, opportunites, dernieres, mrr, jours, rdvAVenir };
}
