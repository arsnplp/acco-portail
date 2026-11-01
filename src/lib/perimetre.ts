/**
 * Périmètre d'un membre externe (EXPERT prestataire, SPECIALISTE) : uniquement les sites qui lui sont attribués
 * (développeur attitré) et les clients de ces sites (section 13). Les autres rôles de l'équipe voient tout.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { estExterne } from "@/lib/permissions";

type U = { id: string; role: "CLIENT" | "ADMIN" | "COMMERCIAL" | "DEV" | "EXPERT" | "SPECIALISTE"; email: string; droits?: string[] };

/** Filtre Prisma à appliquer sur `site` pour ce membre (vide = tout). */
export const whereSitesPour = (u: U) => (estExterne(u) ? { developpeurId: u.id } : {});
/** Filtre Prisma à appliquer sur `client` pour ce membre (vide = tout). */
export const whereClientsPour = (u: U) => (estExterne(u) ? { OR: [{ developpeurId: u.id }, { sites: { some: { developpeurId: u.id } } }] } : {});

export async function peutVoirSite(u: U, siteId: string) {
  if (!estExterne(u)) return true;
  return (await prisma.site.count({ where: { id: siteId, developpeurId: u.id } })) > 0;
}
export async function peutVoirClient(u: U, clientId: string) {
  if (!estExterne(u)) return true;
  return (await prisma.client.count({ where: { id: clientId, ...whereClientsPour(u) } })) > 0;
}
/** À appeler en tête des pages et actions sur un site ou un client : renvoie vers l'accueil si hors périmètre. */
export async function requireSiteAcces(u: U, siteId: string) { if (!(await peutVoirSite(u, siteId))) redirect("/admin/suivi"); }
export async function requireClientAcces(u: U, clientId: string) { if (!(await peutVoirClient(u, clientId))) redirect("/admin/suivi"); }
