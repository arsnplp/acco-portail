"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { can, estExterne } from "@/lib/permissions";
import { demanderValidationCampagne, envoyerTest, lancerCampagne, preparerDestinataires, reprendreErreurs } from "@/lib/campagnes";
import { logActivite } from "@/lib/activite";
import { derniersContacts, JOURS_SANS_CONTACT, clientsAvecRdvAVenir } from "@/lib/alertes";

export type CampState = { error?: string; ok?: string };
const rafraichir = (id: string) => { revalidatePath(`/admin/campagnes/${id}`); revalidatePath("/admin/campagnes"); };

/** Cible : liste d'identifiants (depuis le tableau clients) ou filtre simple. */
async function ciblerClients(fd: FormData) {
  const ids = String(fd.get("clientIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length) return ids;
  const cible = String(fd.get("cible") ?? "tous");
  const commercialId = String(fd.get("commercialId") ?? "") || null;
  const clients = await prisma.client.findMany({ where: { archivedAt: null, ...(commercialId && { commercialId }) }, select: { id: true, createdAt: true, sites: { select: { status: true } } } });
  if (cible === "sans_contact") {
    const [contacts, rdv] = await Promise.all([derniersContacts(clients.map((c) => c.id)), clientsAvecRdvAVenir(clients.map((c) => c.id))]);
    return clients.filter((c) => !rdv.has(c.id) && Date.now() - (contacts.get(c.id) ?? c.createdAt).getTime() > JOURS_SANS_CONTACT * 86400_000).map((c) => c.id);
  }
  if (cible === "en_ligne") return clients.filter((c) => c.sites.some((s) => s.status === "EN_LIGNE")).map((c) => c.id);
  return clients.map((c) => c.id);
}

export async function creerCampagne(_prev: CampState, fd: FormData): Promise<CampState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const titre = String(fd.get("titre") ?? "").trim(), objet = String(fd.get("objet") ?? "").trim(), corpsHtml = String(fd.get("corpsHtml") ?? "").trim();
  if (!titre || !objet || !corpsHtml) return { error: "Titre, objet et contenu sont requis." };
  const plafond = Math.min(200, Math.max(1, parseInt(String(fd.get("plafond") ?? "50"), 10) || 50));
  const c = await prisma.campagne.create({ data: { titre, objet, corpsHtml, commercial: fd.get("commercial") === "on", plafond, auteurId: me.id } });
  const ids = await ciblerClients(fd);
  const r = await preparerDestinataires(c.id, ids);
  await logActivite({ kind: "campagne", texte: `Campagne « ${titre} » créée (${r.total} destinataires)`, href: `/admin/campagnes/${c.id}`, userId: me.id });
  redirect(`/admin/campagnes/${c.id}`);
}

export async function modifierCampagne(id: string, _prev: CampState, fd: FormData): Promise<CampState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const c = await prisma.campagne.findUnique({ where: { id } });
  if (!c || c.statut !== "BROUILLON") return { error: "Seul un brouillon se modifie." };
  const titre = String(fd.get("titre") ?? "").trim(), objet = String(fd.get("objet") ?? "").trim(), corpsHtml = String(fd.get("corpsHtml") ?? "").trim();
  if (!titre || !objet || !corpsHtml) return { error: "Titre, objet et contenu sont requis." };
  await prisma.campagne.update({ where: { id }, data: { titre, objet, corpsHtml, commercial: fd.get("commercial") === "on", plafond: Math.min(200, Math.max(1, parseInt(String(fd.get("plafond") ?? "50"), 10) || 50)) } });
  if (fd.get("recibler") === "on") await preparerDestinataires(id, await ciblerClients(fd));
  rafraichir(id);
  return { ok: "Enregistré." };
}

export async function testerCampagne(id: string, _prev: CampState, fd: FormData): Promise<CampState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const to = String(fd.get("to") ?? "").trim() || me.email;
  const r = await envoyerTest(id, me.id, to);
  return r.ok ? { ok: `Test envoyé à ${to}.` } : { error: r.error };
}

export async function demanderValidationCampagneAction(id: string): Promise<CampState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const r = await demanderValidationCampagne(id, me.id);
  rafraichir(id); revalidatePath("/admin");
  return "error" in r ? { error: r.error } : { ok: r.creees ? "Validation demandée (droit campagnes)." : "Validation déjà en attente." };
}

export async function lancerCampagneAction(id: string): Promise<CampState> {
  const me = await requireTeam();
  if (!can(me, "campagnes")) return { error: "Réservé aux personnes habilitées (droit campagnes)." };
  const r = await lancerCampagne(id, me.id);
  rafraichir(id);
  return "error" in r ? { error: r.error } : { ok: "Envoi lancé : 5 emails par minute, depuis la boîte de l’auteur." };
}

export async function annulerCampagne(id: string) {
  const me = await requireTeam();
  if (!can(me, "campagnes")) return;
  await prisma.campagne.update({ where: { id }, data: { statut: "ANNULEE" } });
  await prisma.campagneDestinataire.updateMany({ where: { campagneId: id, statut: "EN_ATTENTE" }, data: { statut: "EXCLU", erreur: "Campagne annulée" } });
  await logActivite({ kind: "campagne", texte: `Campagne annulée`, href: `/admin/campagnes/${id}`, userId: me.id });
  rafraichir(id);
}
export async function reprendreCampagne(id: string) {
  const me = await requireTeam();
  if (!can(me, "campagnes")) return;
  await reprendreErreurs(id);
  rafraichir(id);
}
