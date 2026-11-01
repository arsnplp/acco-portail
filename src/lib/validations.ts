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

/** Validateurs par défaut : technique = gestionnaire (Arsène) ; commercial = Direction commerciale (droit validation_commerciale). */
export async function validateursPour(type: ValidationType) {
  const users = await prisma.user.findMany({ where: { role: { not: "CLIENT" } }, select: { id: true, role: true, email: true, droits: true } });
  if (TECHNIQUE.includes(type)) return users.filter((u) => gestionnaireEmails().includes(u.email.toLowerCase()));
  if (type === "MAQUETTE") return users.filter((u) => gestionnaireEmails().includes(u.email.toLowerCase()) || (can(u, "validation_commerciale") && u.role === "ADMIN"));
  return users.filter((u) => can(u, "validation_commerciale"));
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
  if (v.assigneId !== user.id && v.delegueAId !== user.id && !delegue && !peutDecider(user, v.type)) return null;
  const maj = await prisma.validation.update({ where: { id: validationId }, data: { statut, decideParId: user.id, decideAt: now, motif: motif ?? null } });
  await logActivite({ kind: "validation", texte: `${VALIDATION_LABEL[v.type]} : ${statut === "VALIDEE" ? "validée" : "refusée"}${motif ? ` (${motif})` : ""}`, href: v.siteId ? `/admin/sites/${v.siteId}` : v.clientId ? `/admin/clients/${v.clientId}` : null, userId: user.id, clientId: v.clientId, siteId: v.siteId });
  return maj;
}

/** Toutes les validations d'un type sont-elles acquises pour cet objet ? (ex. maquette : Bilel ET Arsène). */
export async function estValide(type: ValidationType, where: { siteId?: string; contratId?: string; objetId?: string }) {
  const rows = await prisma.validation.findMany({ where: { type, ...where }, select: { statut: true } });
  return rows.length > 0 && rows.every((r) => r.statut === "VALIDEE");
}
