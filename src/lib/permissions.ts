/**
 * Droits (section 20.1 du prompt maître) : le rôle donne le métier et les modules ; des droits unitaires s'y ajoutent
 * par utilisateur (Lucas : Direction sans administration ; chef de service ; délégataire…). Contrôlés côté serveur.
 */
import type { Role } from "@prisma/client";
import { isGestionnaire } from "@/lib/roles";

export const DROITS = {
  pilotage: "Pilotage (Direction)",
  equipe: "Gérer les comptes et les rôles",
  reglages: "Clés, connecteurs et réglages (Administration)",
  ia_admin: "Interrupteurs IA et intégrations",
  validation_commerciale: "Valider prix, remises, exceptions et contrats (Bilel, Lucas)",
  validation_technique: "Valider briefs, maquettes et mises en ligne (Arsène)",
  go_live: "Autoriser la mise en ligne d’un site",
  dates_production: "Modifier les dates de production",
  finance: "Voir et saisir les montants, paiements, impayés, charges",
  attribuer: "Attribuer et réattribuer clients, prospects et demandes",
  campagnes: "Préparer et valider les envois groupés",
  archiver: "Archiver des clients, contrats, projets",
} as const;
export type Droit = keyof typeof DROITS;

type U = { id: string; role: Role; email: string; droits?: string[] };

/** Droits implicites par rôle. ADMIN = Direction avec accès total ; le gestionnaire (Arsène) a en plus le technique. */
const PAR_ROLE: Record<Role, Droit[]> = {
  ADMIN: ["pilotage", "equipe", "reglages", "ia_admin", "validation_commerciale", "finance", "attribuer", "campagnes", "archiver"],
  COMMERCIAL: [],
  DEV: [],
  EXPERT: [],
  SPECIALISTE: [],
  CLIENT: [],
};

export function can(user: U | null | undefined, droit: Droit): boolean {
  if (!user || user.role === "CLIENT") return false;
  if (isGestionnaire(user)) return true; // Arsène : tout, y compris validation_technique, go_live, dates_production
  if (PAR_ROLE[user.role].includes(droit)) return true;
  return (user.droits ?? []).includes(droit);
}
export const estDirection = (u: U | null | undefined) => can(u, "pilotage");
/** Prestataires et spécialistes : périmètre limité aux projets attribués (section 13). */
export const estExterne = (u: U | null | undefined) => !!u && (u.role === "EXPERT" || u.role === "SPECIALISTE");
export const droitsDe = (u: U) => (Object.keys(DROITS) as Droit[]).filter((d) => can(u, d));
