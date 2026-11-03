/**
 * Garde-fous de production (sections 5.3, 10.3 à 10.7) : paiement ou dérogation avant de produire, brief doublement validé,
 * maquette validée Bilel + Arsène puis « Envoyer maquette » explicite, go-live autorisé par Arsène après checklist,
 * dates réservées, réception signée, tâches récurrentes seulement pour les services souscrits.
 */
import type { ProjectStep } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { productionAutorisee } from "@/lib/contrats";
import { estValide, demanderValidation } from "@/lib/validations";
import { chargerBrief, completude, lireContenu } from "@/lib/brief";
import { logActivite } from "@/lib/activite";
import { creerTache } from "@/lib/taches-client";
import { notifyClient } from "@/lib/notify";
import { sendPushToUser } from "@/lib/push";
import { stepLabel } from "@/lib/labels";

/** Points manuels de la checklist (le reste est vérifié par le script, src/lib/qa.ts). */
export const CHECKLIST_MANUELLE = ["Dernière version validée par le client", "Textes relus (orthographe, informations à jour)", "Accès et sauvegardes en place"];
export const CHECKLIST_GO_LIVE = CHECKLIST_MANUELLE;

export type EtatProduction = Awaited<ReturnType<typeof etatProduction>>;
/** État complet d'un site en production : prérequis, blocages, actions attendues (cartes Kanban, fiche site, tableau de bord). */
export async function etatProduction(siteId: string) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, include: { assets: { select: { storagePath: true, label: true } }, changeRequests: { where: { status: { not: "TERMINEE" } }, select: { id: true } }, retours: { where: { fait: false }, select: { id: true } }, client: { select: { commercialId: true, name: true } } } });
  const [prod, brief, maquetteValidee, maquetteEnAttente, goLiveEnAttente] = await Promise.all([
    productionAutorisee(site.contratId), prisma.brief.findUnique({ where: { siteId } }), estValide("MAQUETTE", { siteId }),
    prisma.validation.count({ where: { siteId, type: "MAQUETTE", statut: "EN_ATTENTE" } }), prisma.validation.count({ where: { siteId, type: "GO_LIVE", statut: "EN_ATTENTE" } }),
  ]);
  const briefOk = brief?.etat === "VALIDE";
  const docsManquants = site.assets.filter((a) => !a.storagePath).map((a) => a.label);
  const blocages: string[] = [];
  const actions: string[] = [];
  if (!prod.ok) blocages.push(prod.raison ?? "Production non autorisée");
  if (!briefOk) blocages.push(brief ? `Brief ${brief.etat === "ATTENDU_CLIENT" ? "attendu du client" : brief.etat === "COMPLET" ? "complet, à valider (commercial puis Arsène)" : "en cours"}` : "Brief non ouvert");
  if (docsManquants.length) blocages.push(`${docsManquants.length} élément${docsManquants.length > 1 ? "s" : ""} manquant${docsManquants.length > 1 ? "s" : ""} : ${docsManquants.slice(0, 2).join(", ")}`);
  if (site.projectStep === "VALIDER_MAQUETTE") {
    if (!maquetteValidee) actions.push(maquetteEnAttente ? "Validation interne de la maquette en attente (Bilel et Arsène)" : "Demander la validation interne de la maquette");
    else if (!site.maquetteEnvoyeeAt) actions.push("Maquette validée : prendre RDV avec le client, puis « Envoyer maquette »");
    else actions.push("Maquette envoyée : retour du client attendu");
  }
  if (site.status === "EN_CREATION" && site.retours.length) actions.push(`${site.retours.length} retour${site.retours.length > 1 ? "s" : ""} de création à faire (V${site.version})`);
  if (site.projectStep === "A_LIVRER") actions.push(site.goLiveAutoriseAt ? "Mise en ligne autorisée : livrer" : goLiveEnAttente ? "Autorisation de mise en ligne en attente (Arsène)" : "Checklist puis demande d’autorisation de mise en ligne");
  return { site, prod, brief, briefOk, maquetteValidee, maquetteEnAttente: maquetteEnAttente > 0, goLiveEnAttente: goLiveEnAttente > 0, docsManquants, modifsOuvertes: site.status === "EN_CREATION" ? site.retours.length : site.changeRequests.length, blocages, actions };
}

/** Transition d'étape autorisée ? Renvoie le motif du refus sinon. */
export async function gardeFous(siteId: string, cible: ProjectStep | "LIVRE", user: { id: string; role: string; email: string; droits?: string[] }) {
  const e = await etatProduction(siteId);
  const ordre: ProjectStep[] = ["CREER_MAQUETTE", "VALIDER_MAQUETTE", "MODIFIER", "VALIDER_MODIFICATION", "FINIR", "A_LIVRER"];
  const avance = cible === "LIVRE" || ordre.indexOf(cible) > ordre.indexOf(e.site.projectStep);
  if (!avance) return null; // reculer est toujours possible (retour en modification…)
  if (e.site.projectStep === "CREER_MAQUETTE" && !e.prod.ok) return `Production bloquée : ${e.prod.raison}.`;
  if (e.site.projectStep === "CREER_MAQUETTE" && !e.briefOk) return "Le brief doit être validé par le commercial référent puis par Arsène avant de présenter une maquette.";
  if (e.site.projectStep === "VALIDER_MAQUETTE" && !e.maquetteValidee) return "La maquette doit être validée en interne (Bilel et Arsène) avant d’avancer.";
  if (e.site.projectStep === "VALIDER_MAQUETTE" && !e.site.maquetteEnvoyeeAt) return "Cliquez « Envoyer maquette » après le rendez-vous client avant de passer aux modifications.";
  if (cible === "LIVRE") {
    const { can } = await import("@/lib/permissions");
    if (!e.site.goLiveAutoriseAt && !can(user as never, "go_live")) return "Mise en ligne non autorisée : checklist puis accord technique d’Arsène requis.";
  }
  return null;
}

/** Demande la validation interne de la maquette (Bilel ET Arsène) ; idempotent. */
export async function demanderValidationMaquette(siteId: string, userId: string) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, clientId: true, version: true, previewUrl: true } });
  return demanderValidation({ type: "MAQUETTE", siteId, clientId: site.clientId, demandeParId: userId, commentaire: `${site.name} V${site.version}${site.previewUrl ? ` · ${site.previewUrl}` : ""}`, href: `/admin/sites/${siteId}` });
}

/** Clic explicite « Envoyer maquette » (10.4) : seulement après validation interne ; le lien devient visible du client. */
export async function envoyerMaquette(siteId: string, userId: string) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, clientId: true, previewUrl: true, version: true, maquetteEnvoyeeAt: true } });
  if (!(await estValide("MAQUETTE", { siteId }))) return { error: "La maquette n’est pas validée en interne (Bilel et Arsène)." };
  if (!site.previewUrl) return { error: "Renseignez d’abord le lien de prévisualisation du site." };
  await prisma.site.update({ where: { id: siteId }, data: { maquetteEnvoyeeAt: new Date(), maquetteEnvoyeeParId: userId } });
  await notifyClient({ clientId: site.clientId, siteId, kind: "MAQUETTE_DISPONIBLE", pref: "changes", title: `Votre maquette V${site.version} est disponible`, body: `${site.name} : découvrez-la dans votre espace et dites-nous ce que vous en pensez.`, href: `/sites/${siteId}` }).catch(() => null);
  await prisma.tacheClient.updateMany({ where: { siteId, type: "RDV_A_PLANIFIER", statut: "A_FAIRE", source: "maquette" }, data: { statut: "FAIT", faitAt: new Date() } });
  await logActivite({ kind: "site_etape", texte: `${site.name} : maquette V${site.version} envoyée au client`, href: `/admin/sites/${siteId}`, userId, clientId: site.clientId, siteId });
  return { ok: true as const };
}

/** Demande d'autorisation de mise en ligne (10.6) : checklist complète exigée, validation GO_LIVE pour Arsène. */
export async function demanderGoLive(siteId: string, userId: string, coches: string[]) {
  const manquantes = CHECKLIST_MANUELLE.filter((c) => !coches.includes(c));
  if (manquantes.length) return { error: `Checklist incomplète : ${manquantes[0]}${manquantes.length > 1 ? ` (+${manquantes.length - 1})` : ""}.` };
  const { dernierRapportQA } = await import("@/lib/qa");
  const qa = await dernierRapportQA(siteId);
  if (!qa) return { error: "Lancez d’abord la vérification automatique du site." };
  if (Date.now() - new Date(qa.at).getTime() > 7 * 86400_000) return { error: "La vérification automatique date de plus de 7 jours : relancez-la." };
  const echecs = qa.verifs.filter((v) => v.ok === false);
  if (echecs.length) return { error: `Vérification automatique en échec : ${echecs.map((v) => v.label).slice(0, 2).join(", ")}${echecs.length > 2 ? ` (+${echecs.length - 2})` : ""}.` };
  const retours = await prisma.retourCreation.count({ where: { siteId, fait: false } });
  if (retours) return { error: `${retours} retour${retours > 1 ? "s" : ""} de création non traité${retours > 1 ? "s" : ""}.` };
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, clientId: true, version: true } });
  const n = await demanderValidation({ type: "GO_LIVE", siteId, clientId: site.clientId, demandeParId: userId, commentaire: `${site.name} V${site.version} : vérification automatique OK (${qa.verifs.length} points, ${qa.pages} pages) + checklist manuelle`, href: `/admin/sites/${siteId}` });
  await logActivite({ kind: "validation", texte: `${site.name} : autorisation de mise en ligne demandée (checklist complète)`, href: `/admin/sites/${siteId}`, userId, clientId: site.clientId, siteId });
  return { ok: true as const, creees: n };
}

/** Modification des dates de production (10.6) : réservée (droit dates_production), trace ancienne/nouvelle + motif, agendas prévenus. */
export async function changerDates(siteId: string, userId: string, dates: { deadlineV1: Date | null; deadlineV2: Date | null; deadlineLivraison: Date | null }, motif: string | null) {
  const avant = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, clientId: true, deadlineV1: true, deadlineV2: true, deadlineLivraison: true, developpeurId: true, client: { select: { commercialId: true } } } });
  const f = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR") : "—");
  const changements = (["deadlineV1", "deadlineV2", "deadlineLivraison"] as const).filter((k) => (avant[k]?.getTime() ?? 0) !== (dates[k]?.getTime() ?? 0)).map((k) => `${k === "deadlineV1" ? "V1" : k === "deadlineV2" ? "V2" : "Livraison"} ${f(avant[k])} → ${f(dates[k])}`);
  if (changements.length === 0) return false;
  await prisma.site.update({ where: { id: siteId }, data: dates });
  await logActivite({ kind: "dates_production", texte: `${avant.name} : dates modifiées (${changements.join(", ")})${motif ? ` · ${motif}` : ""}`, href: `/admin/sites/${siteId}`, userId, clientId: avant.clientId, siteId });
  for (const id of new Set([avant.client.commercialId, avant.developpeurId].filter((x): x is string => !!x && x !== userId))) await sendPushToUser(id, { title: `${avant.name} : dates de production modifiées`, body: changements.join(" · "), url: `/admin/sites/${siteId}`, tag: `dates-${siteId}` }).catch(() => null);
  return true;
}

/** À la livraison (10.6) : tâches récurrentes uniquement pour les services réellement souscrits sur ce site. */
export async function tachesRecurrentesLivraison(siteId: string, userId: string) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, include: { subscriptions: { where: { status: "ACTIF" }, include: { offer: { select: { name: true } } } }, client: { select: { commercialId: true, developpeurId: true } } } });
  let n = 0;
  for (const s of site.subscriptions) {
    const libelle = s.offer?.name ?? s.label;
    const l = libelle.toLowerCase();
    const type = s.module === "AVIS" || /avis|google|gbp|fiche/.test(l) ? "MAINTENANCE" : /blog|article|seo|contenu/.test(l) ? "MAINTENANCE" : "MAINTENANCE";
    const titre = s.module === "AVIS" || /avis|google|gbp|fiche/.test(l) ? `Avis Google : répondre et suivre (${libelle})` : /blog|article|seo|contenu/.test(l) ? `Contenu / SEO : point mensuel (${libelle})` : s.billing === "MENSUEL" ? `Maintenance et hébergement : point mensuel (${libelle})` : null;
    if (!titre) continue;
    await creerTache({ clientId: site.clientId, siteId, type, titre, description: "Tâche récurrente mensuelle créée à la livraison, pour un service souscrit.", echeance: new Date(new Date().setMonth(new Date().getMonth() + 1)), responsableId: site.developpeurId ?? site.client.developpeurId ?? site.client.commercialId, source: "livraison", createdById: userId, notifier: false });
    n++;
  }
  if (site.recapAuto) await creerTache({ clientId: site.clientId, siteId, type: "EMAIL", titre: `Récap mensuel : vérifier l’envoi (${site.name})`, echeance: new Date(new Date().setMonth(new Date().getMonth() + 1)), responsableId: site.client.commercialId, source: "livraison", createdById: userId, notifier: false });
  return n;
}

/** Étape suivante quand la liste de retours de création est terminée (10.5) : nouvelle version à présenter, action commerciale. */
export async function modificationsTerminees(siteId: string, userId: string | null) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, clientId: true, status: true, projectStep: true, version: true, retours: { where: { fait: false }, select: { id: true } } } });
  if (site.status !== "EN_CREATION" || site.projectStep !== "MODIFIER" || site.retours.length > 0) return false;
  await prisma.site.update({ where: { id: siteId }, data: { projectStep: "VALIDER_MODIFICATION", etapeAt: new Date(), version: site.version + 1 } });
  await creerTache({ clientId: site.clientId, siteId, type: "RDV_A_PLANIFIER", titre: `Présenter la V${site.version + 1} de ${site.name} au client`, description: "Toutes les modifications sont terminées : proposer un rendez-vous ou demander la validation.", source: "maquette", createdById: userId, notifier: true });
  await logActivite({ kind: "site_etape", texte: `${site.name} passe à « ${stepLabel("VALIDER_MODIFICATION")} » (V${site.version + 1}, modifications terminées)`, href: `/admin/sites/${siteId}`, userId, clientId: site.clientId, siteId });
  return true;
}

export { chargerBrief, completude, lireContenu };
