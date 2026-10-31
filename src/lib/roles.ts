import type { Role } from "@prisma/client";

/**
 * Rôles et modules.
 * - Pilotage : Direction (ADMIN) seulement ;
 * - Prospection (CRM) : Direction et Commerciaux ;
 * - Suivi (clients, sites, production) : toute l'équipe (jamais les clients) ;
 * - Espace client : clients seulement.
 * Le gestionnaire (Arsène) est un membre de la Direction qui, en plus, gère les clés API, Google et les réglages de l'agence.
 */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Direction", COMMERCIAL: "Commercial", DEV: "Développeur", EXPERT: "Expert (prestataire)", SPECIALISTE: "Spécialiste", CLIENT: "Client",
};
/** Rôles de l'équipe (tout sauf client), dans l'ordre d'affichage. */
export const EQUIPE: Role[] = ["ADMIN", "COMMERCIAL", "DEV", "EXPERT", "SPECIALISTE"];
export const MODULES = {
  pilotage: ["ADMIN"] as Role[],
  prospection: ["ADMIN", "COMMERCIAL"] as Role[],
  suivi: EQUIPE,
  client: ["CLIENT"] as Role[],
} as const;
export type Module = keyof typeof MODULES;
export const canAccess = (role: Role, module: Module) => MODULES[module].includes(role);
export const isEquipe = (role: Role) => role !== "CLIENT";
/** Page d'accueil selon le rôle. */
export function homeFor(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "COMMERCIAL") return "/crm";
  if (role === "CLIENT") return "/";
  return "/admin/suivi";
}

/**
 * Qui gère quoi :
 * - le gestionnaire (Arsène) : le Suivi client (portail, clés API, Google) ; il reçoit les notifications de cette partie ;
 * - les autres membres de l'équipe (admins comme Bilel, commerciaux) : le Suivi commercial (CRM) ; ils reçoivent celles du CRM.
 * Emails des gestionnaires dans GESTIONNAIRE_EMAILS (séparés par des virgules), par défaut arsene@acco-lab.fr.
 */
export function gestionnaireEmails() {
  return (process.env.GESTIONNAIRE_EMAILS ?? "arsene@acco-lab.fr").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function isGestionnaire(user: { email: string; role: string } | null | undefined) {
  if (!user || user.role !== "ADMIN") return false;
  return gestionnaireEmails().includes(user.email.toLowerCase());
}
