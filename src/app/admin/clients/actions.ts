"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { ensureAuthUser, sendInvitationEmail } from "@/lib/invitations";
import { can, estExterne } from "@/lib/permissions";
import { requireClientAcces } from "@/lib/perimetre";
import { agitCommeReferent } from "@/lib/delegations";
import { logActivite } from "@/lib/activite";
import { teamName } from "@/lib/crm";

export type ActionState = { error?: string };

const clientSchema = z.object({
  name: z.string().trim().min(2, "Nom de l’entreprise requis"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  siren: z.string().trim().optional(),
  ownerEmail: z.string().trim().email("Email du gérant invalide"),
  ownerFirstName: z.string().trim().min(1, "Prénom du gérant requis"),
  ownerLastName: z.string().trim().optional(),
});

export async function createClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTeam();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ownerEmail = d.ownerEmail.toLowerCase();

  let userId: string;
  try {
    userId = await ensureAuthUser(ownerEmail, { first_name: d.ownerFirstName, last_name: d.ownerLastName });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossible de créer le compte" };
  }

  const client = await prisma.client.create({
    data: {
      name: d.name,
      address: d.address || null,
      phone: d.phone || null,
      email: d.email || null,
      siren: d.siren || null,
      conversation: { create: {} },
      memberships: {
        create: {
          role: "OWNER",
          user: {
            connectOrCreate: {
              where: { id: userId },
              create: { id: userId, email: ownerEmail, firstName: d.ownerFirstName, lastName: d.ownerLastName || null, role: "CLIENT" },
            },
          },
        },
      },
    },
  });
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${client.id}`);
}

/** Informations légales du client (SIRET, forme juridique, TVA, RCS, capital, signataire) : base des contrats générés. */
export async function updateClientLegal(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const d = Object.fromEntries(formData) as Record<string, string>;
  const t = (k: string) => d[k]?.trim() || null;
  const siret = t("siret")?.replace(/\s/g, "") ?? null;
  if (siret && !/^\d{14}$/.test(siret)) return { error: "Le SIRET compte 14 chiffres." };
  const capital = t("capitalEuros") ? Number(t("capitalEuros")!.replace(/[^\d]/g, "")) : null;
  await prisma.client.update({
    where: { id: clientId },
    data: { siret, siren: siret ? siret.slice(0, 9) : t("siren")?.replace(/\s/g, "") ?? undefined, formeJuridique: t("formeJuridique"), tvaIntra: t("tvaIntra")?.replace(/\s/g, "").toUpperCase() ?? null, rcsVille: t("rcsVille"), capitalEuros: capital && Number.isFinite(capital) ? capital : null, representantNom: t("representantNom"), representantFonction: t("representantFonction"), address: t("address") ?? undefined },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function updateClient(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const d = Object.fromEntries(formData) as Record<string, string>;
  if (!d.name?.trim()) return { error: "Nom requis" };
  await prisma.client.update({
    where: { id: clientId },
    data: { name: d.name.trim(), address: d.address?.trim() || null, phone: d.phone?.trim() || null, email: d.email?.trim() || null, siren: d.siren?.trim() || null, secteur: d.secteur?.trim() || null },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

// ─── Logo (00.1) ─────────────────
export async function uploadLogo(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  try { const { enregistrerLogo } = await import("@/lib/logo"); await enregistrerLogo(clientId, file); }
  catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/admin/clients/${clientId}`); revalidatePath("/admin/clients");
  return {};
}
export async function removeLogo(clientId: string) {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const { supprimerLogo } = await import("@/lib/logo");
  await supprimerLogo(clientId);
  revalidatePath(`/admin/clients/${clientId}`); revalidatePath("/admin/clients");
}

// ─── Contacts (plusieurs interlocuteurs par client, section 4.2) ─────────────────
export async function saveClientContact(clientId: string, contactId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const d = Object.fromEntries(formData) as Record<string, string>;
  const prenom = d.prenom?.trim() || null, nom = d.nom?.trim() || null, email = d.email?.trim().toLowerCase() || null, telephone = d.telephone?.trim() || null;
  if (!prenom && !nom && !email && !telephone) return { error: "Renseignez au moins un nom, un email ou un téléphone." };
  if (email && !z.string().email().safeParse(email).success) return { error: "Email invalide." };
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { crmProspect: { select: { id: true } } } });
  const data = { prenom, nom, fonction: d.fonction?.trim() || null, email, telephone, principal: d.principal === "on", optOutCommercial: d.optOut === "on" };
  await prisma.$transaction(async (tx) => {
    if (data.principal) await tx.prospectContact.updateMany({ where: { OR: [{ clientId }, ...(client?.crmProspect ? [{ prospectId: client.crmProspect.id }] : [])] }, data: { principal: false } });
    if (contactId) await tx.prospectContact.update({ where: { id: contactId }, data: { ...data, clientId } });
    else await tx.prospectContact.create({ data: { ...data, clientId, prospectId: client?.crmProspect?.id ?? null } });
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}
export async function deleteClientContact(clientId: string, contactId: string) {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  await prisma.prospectContact.deleteMany({ where: { id: contactId, OR: [{ clientId }, { prospect: { clientId } }] } });
  revalidatePath(`/admin/clients/${clientId}`);
}

// ─── Référent : réattribution définitive (section 3.3), journalisée ─────────────────
export async function reattribuerClient(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { commercial: { select: { firstName: true, email: true } } } });
  if (!client) return { error: "Client introuvable." };
  if (!can(me, "attribuer") && !(await agitCommeReferent(me.id, client))) return { error: "Réservé au référent, à son délégataire ou à la Direction." };
  const nouveauId = String(formData.get("commercialId") ?? "") || null;
  const motif = String(formData.get("motif") ?? "").trim() || null;
  if (nouveauId === client.commercialId) return { error: "C’est déjà le référent." };
  const nouveau = nouveauId ? await prisma.user.findUnique({ where: { id: nouveauId }, select: { id: true, firstName: true, email: true, role: true } }) : null;
  if (nouveauId && (!nouveau || nouveau.role === "CLIENT")) return { error: "Membre introuvable." };
  await prisma.$transaction([
    prisma.client.update({ where: { id: clientId }, data: { commercialId: nouveauId } }),
    // Tâches à faire et RDV à venir suivent le nouveau référent (transfert cohérent, section 3.3).
    prisma.tacheClient.updateMany({ where: { clientId, statut: "A_FAIRE", responsableId: client.commercialId }, data: { responsableId: nouveauId } }),
    prisma.rendezVous.updateMany({ where: { clientId, resultat: "PREVU", debut: { gte: new Date() }, commercialId: client.commercialId }, data: { commercialId: nouveauId } }),
    // La fiche prospect gagnée et les contrats signés suivent aussi : les stats « qui a signé quoi » restent justes.
    prisma.prospect.updateMany({ where: { clientId }, data: { commercialId: nouveauId } }),
    prisma.contrat.updateMany({ where: { clientId, statut: "SIGNE" }, data: { commercialId: nouveauId } }),
  ]);
  await logActivite({ kind: "reattribution", texte: `Référent : ${client.commercial ? teamName(client.commercial) : "personne"} → ${nouveau ? teamName(nouveau) : "personne"}${motif ? ` · ${motif}` : ""}`, href: `/admin/clients/${clientId}`, userId: me.id, clientId });
  revalidatePath(`/admin/clients/${clientId}`); revalidatePath("/admin/clients");
  return {};
}

// ─── Archivage (section 20.3) : jamais de suppression ─────────────────
export async function archiverClient(clientId: string, restaurer = false) {
  const me = await requireTeam();
  if (!can(me, "archiver")) return;
  await prisma.client.update({ where: { id: clientId }, data: restaurer ? { statut: "ACTIF", archivedAt: null } : { statut: "ARCHIVE", archivedAt: new Date() } });
  await logActivite({ kind: "archivage", texte: restaurer ? "Client restauré" : "Client archivé (données conservées)", href: `/admin/clients/${clientId}`, userId: me.id, clientId });
  revalidatePath(`/admin/clients/${clientId}`); revalidatePath("/admin/clients");
}

// ─── Tâches et rendez-vous post-signature (section 7) ─────────────────
const TYPES_TACHE = ["RELANCE", "RDV_A_PLANIFIER", "APPEL", "EMAIL", "DOCUMENT", "MAINTENANCE", "AUTRE"] as const;
export async function creerTacheClientAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const d = Object.fromEntries(formData) as Record<string, string>;
  if (!d.titre?.trim()) return { error: "Donnez un titre à la tâche." };
  const type = TYPES_TACHE.includes(d.type as (typeof TYPES_TACHE)[number]) ? (d.type as (typeof TYPES_TACHE)[number]) : "AUTRE";
  const { creerTache } = await import("@/lib/taches-client");
  await creerTache({ clientId, siteId: d.siteId || null, type, titre: d.titre.trim(), description: d.description?.trim() || null, echeance: d.echeance ? new Date(`${d.echeance}T09:00:00`) : null, responsableId: d.responsableId || me.id, source: "saisie", createdById: me.id, notifier: !!d.responsableId && d.responsableId !== me.id });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}
export async function terminerTacheAction(clientId: string, tacheId: string, statut: "FAIT" | "ANNULEE" | "A_FAIRE") {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  await prisma.tacheClient.updateMany({ where: { id: tacheId, clientId }, data: { statut, faitAt: statut === "FAIT" ? new Date() : null } });
  revalidatePath(`/admin/clients/${clientId}`); revalidatePath("/admin");
}
export async function creerRdvClientAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const d = Object.fromEntries(formData) as Record<string, string>;
  if (!d.date || !d.heure) return { error: "Date et heure requises." };
  const { parisDateTime } = await import("@/lib/crm");
  const debut = parisDateTime(d.date, d.heure);
  if (Number.isNaN(debut.getTime())) return { error: "Date invalide." };
  const dureeMin = Math.max(15, parseInt(d.duree || "60", 10) || 60);
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  const organisateur = d.commercialId && d.commercialId !== me.id && !can(me, "attribuer") ? me.id : d.commercialId || me.id;
  const rdv = await prisma.rendezVous.create({ data: { clientId, siteId: d.siteId || null, commercialId: organisateur, titre: d.titre?.trim() || null, debut, dureeMin, lieu: d.lieu?.trim() || null, meet: d.meet === "on", invites: formData.getAll("invites").map((e) => String(e).toLowerCase()).filter((e) => e.includes("@")) } });
  // Dans l'agenda Google du membre si son compte est connecté (silencieux sinon) ; invités = contacts cochés ; Meet sur demande.
  const contactsClient = new Set((await prisma.prospectContact.findMany({ where: { OR: [{ clientId }, { prospect: { clientId } }], email: { not: null } }, select: { email: true } })).map((c) => c.email!.toLowerCase()));
  const invites = formData.getAll("invites").map((e) => String(e).toLowerCase()).filter((e) => contactsClient.has(e));
  const { upsertAgendaEvent } = await import("@/lib/agenda");
  const g = await upsertAgendaEvent(rdv.commercialId!, `rdv-client:${rdv.id}`, { titre: `${d.titre?.trim() || "RDV"} · ${client?.name ?? "client"}`, debut, fin: new Date(debut.getTime() + dureeMin * 60_000), lieu: rdv.lieu, description: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/clients/${clientId}`, invites, meet: d.meet === "on" }).catch(() => ({ ok: false, meetUrl: null }));
  if (g.meetUrl) await prisma.rendezVous.update({ where: { id: rdv.id }, data: { meetUrl: g.meetUrl } });
  // Une tâche « RDV à planifier » encore ouverte est close.
  await prisma.tacheClient.updateMany({ where: { clientId, type: "RDV_A_PLANIFIER", statut: "A_FAIRE", ...(d.siteId ? { OR: [{ siteId: d.siteId }, { siteId: null }] } : {}) }, data: { statut: "FAIT", faitAt: new Date() } });
  await logActivite({ kind: "rdv", texte: `RDV fixé le ${debut.toLocaleDateString("fr-FR")}${d.titre ? ` : ${d.titre.trim()}` : ""}`, href: `/admin/clients/${clientId}?onglet=taches`, userId: me.id, clientId, siteId: d.siteId || null });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}
export async function setRdvClientResultat(clientId: string, rdvId: string, resultat: "FAIT" | "ANNULE" | "NO_SHOW" | "PREVU") {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const rdv = await prisma.rendezVous.findFirst({ where: { id: rdvId, clientId } });
  if (!rdv) return;
  await prisma.rendezVous.update({ where: { id: rdvId }, data: { resultat } });
  if (resultat === "ANNULE" && rdv.commercialId) { const { deleteAgendaEvent } = await import("@/lib/agenda"); await deleteAgendaEvent(rdv.commercialId, `rdv-client:${rdv.id}`).catch(() => null); }
  revalidatePath(`/admin/clients/${clientId}`);
}

// ─── Rattachement manuel (8.1, 8.2) ─────────────────
export async function rattacherEmailAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const { rattacherMessageGmail } = await import("@/lib/gmail");
  const r = await rattacherMessageGmail(clientId, String(formData.get("ref") ?? ""), me.id);
  revalidatePath(`/admin/clients/${clientId}`);
  return r.ok ? {} : { error: r.error };
}
export async function rattacherAppelAction(clientId: string, echangeId: string) {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  if (estExterne(me)) return;
  const { rattacherAppel } = await import("@/lib/aircall");
  await rattacherAppel(echangeId, clientId);
  revalidatePath(`/admin/clients/${clientId}`);
}
/** Synchronisation manuelle des emails de la fiche (bouton, jamais au chargement : 00.8). */
export async function synchroniserEmailsAction(clientId: string): Promise<{ added?: number; error?: string }> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const { syncClientEmails } = await import("@/lib/gmail");
  const r = await syncClientEmails(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
  return r;
}

// ─── Synthèse IA courte (4.2 bloc 10, sur clic, 00.6) ─────────────────
export async function genererSyntheseClient(clientId: string): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const { iaAutorisee } = await import("@/lib/ia");
  const a = await iaAutorisee("synthese_client");
  if (!a.ok) return { error: a.raison };
  const { enBref } = await import("@/lib/en-bref");
  const { texteIA } = await import("@/lib/ai");
  const bref = await enBref(clientId);
  const faits = [...bref.faits, ...bref.alertes.map((x) => `Alerte : ${x}`), ...bref.opportunites.map((x) => `Opportunité possible : ${x}`), ...bref.dernieres.map((x) => `Interaction : ${x}`)].join("\n");
  const texte = await texteIA("synthese_client",
    "Tu es l’assistant d’une agence web (ACCO LAB). Rédige en français une synthèse courte d’un client pour un commercial. Deux parties obligatoires, titrées exactement « Faits » et « Hypothèses ». Dans « Faits », ne reprends que ce qui est dans les données ; dans « Hypothèses », formule prudemment risques et opportunités. 120 mots maximum, pas de chiffres inventés.",
    faits, 450, me.id);
  if (!texte) return { error: "Synthèse indisponible (IA coupée ou plafond atteint)." };
  await prisma.setting.upsert({ where: { key: `synthese_client:${clientId}` }, create: { key: `synthese_client:${clientId}`, value: JSON.stringify({ texte, at: new Date().toISOString(), par: teamName(me) }) }, update: { value: JSON.stringify({ texte, at: new Date().toISOString(), par: teamName(me) }) } });
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function addMember(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!z.string().email().safeParse(email).success) return { error: "Email invalide" };
  let userId: string;
  try {
    userId = await ensureAuthUser(email, { first_name: firstName });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossible de créer le compte" };
  }
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId, email, firstName: firstName || null, role: "CLIENT" }, update: {} });
  await prisma.clientMembership.upsert({ where: { clientId_userId: { clientId, userId } }, create: { clientId, userId, role: "MEMBER" }, update: {} });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function createSite(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) return { error: "Nom du site requis (ex. boulangerie-dupont.fr)" };
  const site = await prisma.site.create({
    data: {
      clientId,
      name,
      status: "EN_CREATION",
      projectStep: "CREER_MAQUETTE",
      assets: {
        create: [
          { kind: "LOGO", label: "Votre logo" },
          { kind: "TEXTE", label: "Présentation de l’entreprise" },
          { kind: "PHOTO", label: "Photos (5 à 10)" },
        ],
      },
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/sites/${site.id}`);
}

export async function createSubscription(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  if (!can(me, "finance")) return { error: "Réservé au droit finance." };
  const d = Object.fromEntries(formData) as Record<string, string>;
  const price = Math.round(parseFloat((d.price ?? "").replace(",", ".")) * 100);
  if (!d.label?.trim() || !Number.isFinite(price)) return { error: "Libellé et prix requis" };
  await prisma.subscription.create({
    data: {
      clientId,
      siteId: d.siteId || null,
      label: d.label.trim(),
      billing: d.billing === "PONCTUEL" ? "PONCTUEL" : "MENSUEL",
      priceCents: price,
      monthlyQuota: d.monthlyQuota ? parseInt(d.monthlyQuota, 10) : null,
      commitmentEndsAt: d.commitmentEndsAt ? new Date(d.commitmentEndsAt) : null,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function cancelSubscription(clientId: string, subId: string) {
  const me = await requireTeam();
  if (!can(me, "finance")) return;
  await prisma.subscription.update({ where: { id: subId }, data: { status: "RESILIE", cancelledAt: new Date() } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function sendInvitation(clientId: string, userId: string) {
  const admin = await requireTeam();
  await requireClientAcces(admin, clientId);
  if (estExterne(admin)) return;
  const [client, user] = await Promise.all([prisma.client.findUnique({ where: { id: clientId } }), prisma.user.findUnique({ where: { id: userId } })]);
  if (!client || !user) return;
  await sendInvitationEmail({ email: user.email, firstName: user.firstName, clientName: client.name, clientId, inviterId: admin.id });
  revalidatePath(`/admin/clients/${clientId}`);
}

/**
 * Activer une offre du catalogue pour un client, depuis sa fiche (sans passer par une commande).
 * Le client n'est prévenu que si la case est cochée.
 */
export async function activateOffer(clientId: string, offerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  if (!can(me, "finance")) return { error: "Réservé au droit finance (activation hors contrat)." };
  const { activePromo } = await import("@/lib/offers");
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: { promotions: true } });
  if (!offer) return { error: "Offre introuvable" };
  const siteId = String(formData.get("siteId") ?? "") || null;
  if (offer.module !== "NONE" && !siteId) return { error: "Choisissez le site sur lequel débloquer le module." };
  if (siteId && !(await prisma.site.findFirst({ where: { id: siteId, clientId }, select: { id: true } }))) return { error: "Site introuvable" };
  const promo = activePromo(offer);
  const price = promo ? promo.price : offer.priceCents;
  const months = parseInt(String(formData.get("commitmentMonths") ?? "0"), 10) || 0;
  await prisma.subscription.create({
    data: {
      clientId, siteId, offerId, label: offer.name, module: offer.module, billing: offer.billing, priceCents: price,
      commitmentEndsAt: months > 0 ? new Date(new Date().setMonth(new Date().getMonth() + months)) : null,
    },
  });
  // Une commande en attente pour cette offre est considérée comme traitée.
  await prisma.order.updateMany({ where: { clientId, offerId, status: "A_TRAITER" }, data: { status: "VALIDEE", validatedAt: new Date() } });
  if (formData.get("notify") === "on") {
    const { notifyClient } = await import("@/lib/notify");
    const { fmtPrice } = await import("@/lib/format");
    await notifyClient({
      clientId, siteId, kind: "COMMANDE_VALIDEE", pref: "offers",
      title: `${offer.name} : c’est activé`,
      body: `${fmtPrice(price)}${offer.billing === "MENSUEL" ? " / mois" : ""}`,
      href: offer.module !== "NONE" && siteId ? `/sites/${siteId}/avis` : "/compte",
    });
  }
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  revalidatePath("/compte");
  if (siteId) revalidatePath(`/sites/${siteId}`, "layout");
  return {};
}

// ─── Fiche client centralisée (module Suivi) ─────────────────
const FORMULES = ["ESSENTIEL", "REFERENCE", "CONQUETE", "SIGNATURE"] as const;

/** Contrat et suivi : formule, engagement, commercial, développeur, fiche Google, client référence. */
export async function updateClientSuivi(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const d = Object.fromEntries(formData) as Record<string, string>;
  const formule = FORMULES.includes(d.formule as (typeof FORMULES)[number]) ? (d.formule as (typeof FORMULES)[number]) : null;
  const date = (v?: string) => (v ? new Date(`${v}T12:00:00`) : null);
  const gmb = d.gmbUrl?.trim() || null;
  if (gmb && !/^https?:\/\//.test(gmb)) return { error: "Le lien de la fiche Google doit commencer par https://" };
  const avant = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, commercialId: true } });
  const peutAttribuer = can(me, "attribuer") || (avant ? await agitCommeReferent(me.id, avant) : false);
  await prisma.client.update({
    where: { id: clientId },
    data: {
      formule, engagementDebut: date(d.engagementDebut), engagementFin: date(d.engagementFin), gmbUrl: gmb,
      ...(peutAttribuer ? { commercialId: d.commercialId || null, reference: d.reference === "on" } : {}),
      developpeurId: d.developpeurId || null,
    },
  });
  if (peutAttribuer && avant && (d.commercialId || null) !== avant.commercialId) {
    await prisma.prospect.updateMany({ where: { clientId }, data: { commercialId: d.commercialId || null } });
    await prisma.contrat.updateMany({ where: { clientId, statut: "SIGNE" }, data: { commercialId: d.commercialId || null } });
  }
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  return {};
}

const TYPES_CR = ["APPEL", "MAIL", "RDV", "PP", "NOTE"] as const;
/** Compte rendu saisi à la main (appel, réunion, mail…) dans l'historique du client. */
export async function logClientEchange(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireClientAcces(me, clientId);
  const type = String(formData.get("type") ?? "NOTE") as (typeof TYPES_CR)[number];
  const notes = String(formData.get("notes") ?? "").trim();
  if (!TYPES_CR.includes(type)) return { error: "Type inconnu." };
  if (!notes) return { error: "Écrivez le compte rendu." };
  const day = String(formData.get("date") ?? "");
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { crmProspect: { select: { id: true } } } });
  if (!client) return { error: "Client introuvable." };
  await prisma.echange.create({
    data: { clientId, prospectId: client.crmProspect?.id ?? null, type, notes, auteurId: me.id, origine: "saisie", date: day ? new Date(`${day}T12:00:00`) : new Date() },
  });
  const { logActivite } = await import("@/lib/activite");
  const nomClient = (await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }))?.name ?? "client";
  await logActivite({ kind: "compte_rendu", texte: `Compte rendu ajouté pour ${nomClient}`, href: `/admin/clients/${clientId}`, userId: me.id, clientId });
  revalidatePath(`/admin/clients/${clientId}`);
  if (client.crmProspect) revalidatePath(`/crm/prospects/${client.crmProspect.id}`);
  return {};
}

// ─── Tableau clients : vues enregistrées et actions groupées (3.2) ─────────────────
export async function sauverVue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 60);
  const params = String(formData.get("params") ?? "{}");
  if (!nom) return { error: "Nom de la vue requis." };
  let parsed: Record<string, string> = {};
  try { parsed = JSON.parse(params); } catch { return { error: "Filtres invalides." }; }
  await prisma.savedView.create({ data: { userId: me.id, espace: "clients", nom, params: parsed } });
  revalidatePath("/admin/clients");
  return {};
}
export async function supprimerVue(id: string) {
  const me = await requireTeam();
  await prisma.savedView.deleteMany({ where: { id, userId: me.id } });
  revalidatePath("/admin/clients");
}
/**
 * Actions groupées (3.2) : chaque action reste reliée à l'historique de chaque client ; aucune communication sortante
 * sans validation humaine (les emails passent par une campagne à valider).
 */
export async function actionGroupee(_prev: ActionState & { ok?: string }, formData: FormData): Promise<ActionState & { ok?: string }> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const ids = String(formData.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const action = String(formData.get("action") ?? "");
  if (ids.length === 0) return { error: "Aucun client sélectionné." };
  const clients = await prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, commercialId: true } });
  if (action === "email") redirect(`/admin/campagnes/nouvelle?clients=${ids.join(",")}`);
  if (action === "appels") {
    // Campagne d'appels : une tâche individuelle par client, réassignable, pas un appel collectif.
    const { creerTache } = await import("@/lib/taches-client");
    const titre = String(formData.get("titre") ?? "").trim() || "Appeler le client (campagne d’appels)";
    const responsableId = String(formData.get("responsableId") ?? "") || null;
    for (const c of clients) await creerTache({ clientId: c.id, type: "APPEL", titre, echeance: formData.get("echeance") ? new Date(`${formData.get("echeance")}T09:00:00`) : null, responsableId: responsableId ?? c.commercialId ?? me.id, source: "campagne", createdById: me.id, notifier: false });
    await logActivite({ kind: "campagne", texte: `Campagne d’appels : ${clients.length} tâche${clients.length > 1 ? "s" : ""} créée${clients.length > 1 ? "s" : ""} (${titre})`, href: "/admin/taches", userId: me.id });
    revalidatePath("/admin/taches");
    return { ok: `${clients.length} tâche${clients.length > 1 ? "s" : ""} d’appel créée${clients.length > 1 ? "s" : ""}.` };
  }
  if (action === "rdv") {
    const { creerTache } = await import("@/lib/taches-client");
    for (const c of clients) await creerTache({ clientId: c.id, type: "RDV_A_PLANIFIER", titre: "Proposer un rendez-vous", responsableId: c.commercialId ?? me.id, source: "campagne", createdById: me.id, notifier: false });
    revalidatePath("/admin/taches");
    return { ok: `${clients.length} demande${clients.length > 1 ? "s" : ""} de rendez-vous à planifier.` };
  }
  if (action === "reattribuer") {
    if (!can(me, "attribuer")) return { error: "Réservé au droit attribuer." };
    const nouveauId = String(formData.get("commercialId") ?? "") || null;
    const nouveau = nouveauId ? await prisma.user.findUnique({ where: { id: nouveauId }, select: { firstName: true, email: true } }) : null;
    for (const c of clients) {
      await prisma.client.update({ where: { id: c.id }, data: { commercialId: nouveauId } });
      await prisma.tacheClient.updateMany({ where: { clientId: c.id, statut: "A_FAIRE", responsableId: c.commercialId }, data: { responsableId: nouveauId } });
      await prisma.prospect.updateMany({ where: { clientId: c.id }, data: { commercialId: nouveauId } });
      await prisma.contrat.updateMany({ where: { clientId: c.id, statut: "SIGNE" }, data: { commercialId: nouveauId } });
      await logActivite({ kind: "reattribution", texte: `Référent → ${nouveau ? teamName(nouveau) : "personne"} (action groupée)`, href: `/admin/clients/${c.id}`, userId: me.id, clientId: c.id });
    }
    revalidatePath("/admin/clients");
    return { ok: `${clients.length} client${clients.length > 1 ? "s" : ""} réattribué${clients.length > 1 ? "s" : ""}.` };
  }
  if (action === "archiver") {
    if (!can(me, "archiver")) return { error: "Réservé au droit archiver." };
    for (const c of clients) { await prisma.client.update({ where: { id: c.id }, data: { statut: "ARCHIVE", archivedAt: new Date() } }); await logActivite({ kind: "archivage", texte: "Client archivé (action groupée)", href: `/admin/clients/${c.id}`, userId: me.id, clientId: c.id }); }
    revalidatePath("/admin/clients");
    return { ok: `${clients.length} client${clients.length > 1 ? "s" : ""} archivé${clients.length > 1 ? "s" : ""}.` };
  }
  if (action === "etiquette") {
    const secteur = String(formData.get("secteur") ?? "").trim();
    if (!secteur) return { error: "Indiquez l’étiquette (secteur)." };
    await prisma.client.updateMany({ where: { id: { in: ids } }, data: { secteur } });
    revalidatePath("/admin/clients");
    return { ok: `Secteur « ${secteur} » appliqué à ${clients.length} client${clients.length > 1 ? "s" : ""}.` };
  }
  return { error: "Action inconnue." };
}
