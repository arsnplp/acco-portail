/**
 * Circuits de validation à deux niveaux (sections 5.3, 10.3, 10.4, 20.1) : brief commercial + technique,
 * maquette Bilel + Arsène, dérogation de paiement Bilel/Lucas puis Arsène, go-live Arsène, exception tarifaire.
 * Une validation = une ligne, assignée à une personne (ou son délégataire), décidée en un clic.
 */
import type { ValidationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { gestionnaireEmails } from "@/lib/roles";
import { sendPushToUser } from "@/lib/push";
import { logActivite } from "@/lib/activite";

export const VALIDATION_LABEL: Record<ValidationType, string> = {
  BRIEF_COMMERCIAL: "Brief : validation commerciale", BRIEF_TECHNIQUE: "Brief : validation technique", MAQUETTE: "Maquette : validation interne",
  DEROGATION_PAIEMENT_COMMERCIALE: "Démarrer sans premier paiement : exception commerciale", DEROGATION_PAIEMENT_TECHNIQUE: "Démarrer sans premier paiement : accord de production",
  GO_LIVE: "Mise en ligne", EXCEPTION_TARIFAIRE: "Exception tarifaire", LIVRABLE: "Livrable important", CAMPAGNE: "Envoi groupé",
};

/** Qui peut décider de quoi. */
const TECHNIQUE: ValidationType[] = ["BRIEF_TECHNIQUE", "DEROGATION_PAIEMENT_TECHNIQUE", "GO_LIVE"];
const COMMERCIALE: ValidationType[] = ["BRIEF_COMMERCIAL", "DEROGATION_PAIEMENT_COMMERCIALE", "EXCEPTION_TARIFAIRE", "CAMPAGNE"];
export function peutDecider(user: { id: string; role: "CLIENT" | "ADMIN" | "COMMERCIAL" | "DEV" | "EXPERT" | "SPECIALISTE"; email: string; droits?: string[] }, type: ValidationType) {
  if (TECHNIQUE.includes(type)) return can(user, "validation_technique") || can(user, "go_live");
  if (COMMERCIALE.includes(type)) return can(user, "validation_commerciale");
  if (type === "MAQUETTE") return can(user, "validation_commerciale") || can(user, "validation_technique"); // Bilel ET Arsène : une ligne chacun
  return can(user, "validation_commerciale") || can(user, "validation_technique");
}

/**
 * Validateurs par défaut, deux niveaux distincts (20.1) : technique = gestionnaire (Arsène) ou droit validation_technique ;
 * commercial = Direction commerciale (droit validation_commerciale) hors gestionnaire, pour qu'Arsène ne boucle jamais seul la chaîne.
 */
type UV = { id: string; role: "CLIENT" | "ADMIN" | "COMMERCIAL" | "DEV" | "EXPERT" | "SPECIALISTE"; email: string; droits: string[] };
const estTechnique = (u: UV) => gestionnaireEmails().includes(u.email.toLowerCase()) || u.droits.includes("validation_technique");
const estCommercial = (u: UV) => !gestionnaireEmails().includes(u.email.toLowerCase()) && can(u, "validation_commerciale");
export async function validateursPour(type: ValidationType) {
  const users = await prisma.user.findMany({ where: { role: { not: "CLIENT" } }, select: { id: true, role: true, email: true, droits: true } });
  if (TECHNIQUE.includes(type)) return users.filter(estTechnique);
  if (type === "MAQUETTE") return users.filter((u) => estTechnique(u) || (estCommercial(u) && u.role === "ADMIN"));
  const com = users.filter(estCommercial);
  return com.length ? com : users.filter((u) => can(u, "validation_commerciale")); // équipe réduite : à défaut, le gestionnaire
}

/** Crée une validation en attente pour chaque validateur (ou pour `assigneId` si précisé). Idempotent par (type, objet, assigné). */
export async function demanderValidation(opts: { type: ValidationType; clientId?: string | null; siteId?: string | null; contratId?: string | null; objetId?: string | null; demandeParId?: string | null; commentaire?: string | null; assigneId?: string; href?: string }) {
  const cibles = opts.assigneId ? [{ id: opts.assigneId }] : await validateursPour(opts.type);
  let creees = 0;
  for (const u of cibles) {
    const existe = await prisma.validation.findFirst({ where: { type: opts.type, assigneId: u.id, statut: "EN_ATTENTE", siteId: opts.siteId ?? undefined, contratId: opts.contratId ?? undefined, objetId: opts.objetId ?? undefined, clientId: opts.clientId ?? undefined } });
    if (existe) continue;
    await prisma.validation.create({ data: { type: opts.type, assigneId: u.id, clientId: opts.clientId ?? null, siteId: opts.siteId ?? null, contratId: opts.contratId ?? null, objetId: opts.objetId ?? null, demandeParId: opts.demandeParId ?? null, commentaire: opts.commentaire ?? null } });
    await sendPushToUser(u.id, { title: `À valider : ${VALIDATION_LABEL[opts.type]}`, body: opts.commentaire ?? undefined, url: opts.href ?? "/admin", tag: `validation-${opts.type}` }).catch(() => null);
    creees++;
  }
  return creees;
}

/** Validations en attente pour un membre : les siennes et celles des référents qu'il remplace (délégation active). */
export async function enAttentePour(userId: string) {
  const now = new Date();
  const delegues = await prisma.delegation.findMany({ where: { versId: userId, debut: { lte: now }, fin: { gte: now }, clientId: null }, select: { deId: true } });
  return prisma.validation.findMany({
    where: { statut: "EN_ATTENTE", OR: [{ assigneId: userId }, { delegueAId: userId }, { assigneId: { in: delegues.map((d) => d.deId) } }] },
    orderBy: { createdAt: "asc" },
    include: { site: { select: { id: true, name: true, client: { select: { name: true } } } }, client: { select: { id: true, name: true } }, contrat: { select: { id: true, reference: true, titre: true } }, assigne: { select: { firstName: true, email: true } } },
  });
}

/** Décision en un clic. Renvoie la validation mise à jour ; journalise. */
export async function decider(validationId: string, user: { id: string; role: "CLIENT" | "ADMIN" | "COMMERCIAL" | "DEV" | "EXPERT" | "SPECIALISTE"; email: string; droits?: string[] }, statut: "VALIDEE" | "REFUSEE", motif?: string | null) {
  const v = await prisma.validation.findUnique({ where: { id: validationId } });
  if (!v || v.statut !== "EN_ATTENTE") return null;
  const now = new Date();
  const delegue = v.assigneId !== user.id ? await prisma.delegation.count({ where: { versId: user.id, deId: v.assigneId, debut: { lte: now }, fin: { gte: now }, clientId: null } }) : 0;
  // La ligne doit être confiée à l'appelant (assigné, délégataire explicite, ou délégation active) : le droit générique n'est jamais une alternative (20.1).
  const confiee = v.assigneId === user.id || v.delegueAId === user.id || delegue > 0;
  if (!confiee || (v.assigneId === user.id && !peutDecider(user, v.type))) return null;
  const maj = await prisma.validation.update({ where: { id: validationId }, data: { statut, decideParId: user.id, decideAt: now, motif: motif ?? null } });
  const href = v.siteId ? `/admin/sites/${v.siteId}` : v.contratId ? `/admin/contrats/${v.contratId}` : v.clientId ? `/admin/clients/${v.clientId}` : "/admin/validations";
  await logActivite({ kind: "validation", texte: `${VALIDATION_LABEL[v.type]} : ${statut === "VALIDEE" ? "validée" : "refusée"}${motif ? ` (${motif})` : ""}`, href, userId: user.id, clientId: v.clientId, siteId: v.siteId });
  if (v.demandeParId && v.demandeParId !== user.id) {
    await sendPushToUser(v.demandeParId, { title: `${VALIDATION_LABEL[v.type]} : ${statut === "VALIDEE" ? "validée" : "refusée"}`, body: motif ?? undefined, url: href, tag: `validation-${v.id}` }).catch(() => null);
  }
  if (statut === "VALIDEE") await suites(v, user.id, href);
  return maj;
}

/**
 * Enchaînements automatiques (section 20.1) : une validation commerciale acquise déclenche la technique ;
 * le go-live autorise la mise en ligne ; une campagne validée passe en « validée ». Jamais de bouton universel.
 */
async function suites(v: { id: string; type: ValidationType; clientId: string | null; siteId: string | null; contratId: string | null; objetId: string | null; commentaire: string | null; demandeParId: string | null }, userId: string, href: string) {
  const base = { clientId: v.clientId, siteId: v.siteId, contratId: v.contratId, objetId: v.objetId, demandeParId: v.demandeParId ?? userId, commentaire: v.commentaire, href };
  switch (v.type) {
    case "DEROGATION_PAIEMENT_COMMERCIALE":
      await demanderValidation({ ...base, type: "DEROGATION_PAIEMENT_TECHNIQUE" });
      break;
    case "BRIEF_COMMERCIAL":
      if (v.siteId) await prisma.brief.updateMany({ where: { siteId: v.siteId }, data: { validCommercialParId: userId, validCommercialAt: new Date() } });
      await demanderValidation({ ...base, type: "BRIEF_TECHNIQUE" });
      break;
    case "BRIEF_TECHNIQUE":
      if (v.siteId) {
        await prisma.brief.updateMany({ where: { siteId: v.siteId }, data: { validTechniqueParId: userId, validTechniqueAt: new Date() } });
        const b = await prisma.brief.findUnique({ where: { siteId: v.siteId }, select: { validCommercialAt: true } });
        if (b?.validCommercialAt) await prisma.brief.update({ where: { siteId: v.siteId }, data: { etat: "VALIDE" } });
      }
      break;
    case "GO_LIVE":
      if (v.siteId) await prisma.site.update({ where: { id: v.siteId }, data: { goLiveAutoriseAt: new Date(), goLiveAutoriseParId: userId } });
      break;
    case "MAQUETTE":
      // Bilel ET Arsène : quand les deux lignes sont validées, action commerciale « prendre RDV » (jamais d'envoi automatique, 10.4).
      if (v.siteId && (await estValide("MAQUETTE", { siteId: v.siteId }))) {
        const site = await prisma.site.findUnique({ where: { id: v.siteId }, select: { name: true, clientId: true, version: true } });
        if (site) {
          const { creerTache } = await import("@/lib/taches-client");
          await creerTache({ clientId: site.clientId, siteId: v.siteId, type: "RDV_A_PLANIFIER", titre: `Présenter la maquette V${site.version} de ${site.name} au client`, description: "Maquette validée en interne : prendre rendez-vous, puis cliquer « Envoyer maquette » après la réunion.", source: "maquette", createdById: userId, notifier: true });
        }
      }
      break;
    case "CAMPAGNE":
      if (v.objetId) await prisma.campagne.updateMany({ where: { id: v.objetId, statut: "BROUILLON" }, data: { statut: "VALIDEE", validParId: userId, validAt: new Date() } });
      break;
    default:
      break;
  }
}

/** Décisions récentes (30 jours) qui concernent ce membre : prises par lui, ou sur ses demandes. */
export async function decideesRecentes(userId: string) {
  return prisma.validation.findMany({
    where: { statut: { not: "EN_ATTENTE" }, decideAt: { gte: new Date(Date.now() - 30 * 86400_000) }, OR: [{ decideParId: userId }, { demandeParId: userId }, { assigneId: userId }] },
    orderBy: { decideAt: "desc" }, take: 40,
    include: { site: { select: { id: true, name: true, client: { select: { name: true } } } }, client: { select: { id: true, name: true } }, contrat: { select: { id: true, reference: true, titre: true } }, assigne: { select: { firstName: true, email: true } }, decidePar: { select: { firstName: true, email: true } } },
  });
}

/** Toutes les validations d'un type sont-elles acquises pour cet objet ? (ex. maquette : Bilel ET Arsène). */
export async function estValide(type: ValidationType, where: { siteId?: string; contratId?: string; objetId?: string }) {
  const rows = await prisma.validation.findMany({ where: { type, ...where }, select: { statut: true } });
  return rows.length > 0 && rows.every((r) => r.statut === "VALIDEE");
}
