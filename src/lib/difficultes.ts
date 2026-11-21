/**
 * Difficultés signalées par les clients (bouton « Signaler une difficulté » du portail).
 * Circuit : reçue → en cours → résolue, avec une réponse visible du client. L'équipe les traite dans Production
 * et sur la fiche client (onglet Demandes) ; le gestionnaire est prévenu à chaque signalement, le client à chaque réponse.
 */
import type { DifficulteStatut, DifficulteType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DIFFICULTE_STATUT, DIFFICULTE_TYPE } from "@/lib/difficultes-labels";

export { DIFFICULTE_STATUT, DIFFICULTE_TYPE, DELAI_REPONSE } from "@/lib/difficultes-labels";
import { notifyAdmins, notifyClient, excerpt } from "@/lib/notify";
import { logActivite } from "@/lib/activite";


export async function signalerDifficulte(a: { clientId: string; userId: string; siteId?: string | null; type: DifficulteType; message: string }) {
  const message = a.message.trim().slice(0, 2000);
  if (!message) throw new Error("Décrivez le problème en quelques mots.");
  const d = await prisma.difficulte.create({ data: { clientId: a.clientId, siteId: a.siteId ?? null, type: a.type, message }, include: { client: { select: { name: true } }, site: { select: { name: true } } } });
  await logActivite({ kind: "difficulte", texte: `Difficulté signalée (${DIFFICULTE_TYPE[a.type].label}) : ${excerpt(message, 80)}`, href: `/admin/clients/${a.clientId}?onglet=demandes`, userId: a.userId, clientId: a.clientId, siteId: a.siteId ?? null });
  // Prévenir le gestionnaire (push). Un site en panne est aussi signalé en tâche de fond par les alertes, ici c'est la voix du client.
  await notifyAdmins({ pref: "changes", tag: `difficulte-${d.id}`, href: `/admin/production#difficultes`, title: `${d.type === "SITE_EN_PANNE" ? "🚨 " : ""}Difficulté · ${d.client.name}${d.site ? ` · ${d.site.name}` : ""}`, body: `${DIFFICULTE_TYPE[d.type].label} : ${excerpt(message)}` });
  return d;
}

/** Passage d'état par l'équipe, avec réponse facultative ; le client est prévenu (push + email selon ses réglages). */
export async function majDifficulte(id: string, a: { statut: DifficulteStatut; reponse?: string | null; userId: string }) {
  const avant = await prisma.difficulte.findUniqueOrThrow({ where: { id }, select: { statut: true, reponse: true, clientId: true, siteId: true, type: true, prisEnChargeAt: true } });
  const reponse = a.reponse?.trim().slice(0, 2000) || avant.reponse;
  const now = new Date();
  const d = await prisma.difficulte.update({
    where: { id },
    data: { statut: a.statut, reponse, traiteParId: a.userId, prisEnChargeAt: a.statut !== "RECUE" && !avant.prisEnChargeAt ? now : undefined, resoluAt: a.statut === "RESOLUE" ? now : null },
  });
  const change = avant.statut !== a.statut || (reponse && reponse !== avant.reponse);
  if (change) {
    const titre = a.statut === "RESOLUE" ? "Votre difficulté est résolue" : a.statut === "EN_COURS" ? "On s’occupe de votre difficulté" : "Difficulté mise à jour";
    await notifyClient({ clientId: d.clientId, siteId: d.siteId, kind: "DIFFICULTE", pref: "changes", title: titre, body: reponse ? excerpt(reponse, 200) : `${DIFFICULTE_TYPE[d.type].label} · ${DIFFICULTE_STATUT[a.statut].label.toLowerCase()}`, href: "/difficultes" });
    await logActivite({ kind: "difficulte", texte: `Difficulté ${DIFFICULTE_STATUT[a.statut].label.toLowerCase()}${reponse ? ` : ${excerpt(reponse, 80)}` : ""}`, href: `/admin/clients/${d.clientId}?onglet=demandes`, userId: a.userId, clientId: d.clientId, siteId: d.siteId });
  }
  return d;
}

export const difficultesOuvertes = () => prisma.difficulte.findMany({ where: { statut: { not: "RESOLUE" } }, orderBy: [{ statut: "asc" }, { createdAt: "asc" }], include: { client: { select: { id: true, name: true, logoMiniPath: true } }, site: { select: { id: true, name: true } }, traitePar: { select: { firstName: true, email: true } } } });
