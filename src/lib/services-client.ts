/** Services du client (portail) : site, fiche Google, publicité. Déduits des abonnements actifs (libellé ou offre). */
import { prisma } from "@/lib/prisma";

export type ServiceKey = "site" | "google" | "ads";
export const SERVICES: Record<ServiceKey, { label: string; court: string; benef: string; cta: string; kind: string }> = {
  site: { label: "Site", court: "Votre site web", benef: "", cta: "", kind: "" },
  google: { label: "Fiche Google", court: "Votre fiche Google Business", benef: "Votre fiche Google, c’est ce que voient vos clients quand ils vous cherchent sur Maps. Optimisée et animée chaque mois, elle fait venir plus d’appels et de visites en boutique.", cta: "Je veux ma fiche Google optimisée", kind: "demande_google" },
  ads: { label: "Publicité", court: "Vos campagnes Google Ads", benef: "La publicité Google vous place en premier sur les recherches de votre zone, dès cette semaine. Vous fixez le budget, nous gérons les campagnes et vous suivez les résultats ici.", cta: "Je veux lancer de la publicité", kind: "demande_ads" },
};

export async function servicesSouscrits(clientId: string) {
  const [subs, sites] = await Promise.all([
    prisma.subscription.findMany({ where: { clientId, status: "ACTIF" }, select: { label: true, module: true, offer: { select: { name: true } } } }),
    prisma.site.count({ where: { clientId } }),
  ]);
  const libs = subs.map((s) => `${s.label} ${s.offer?.name ?? ""} ${s.module}`.toLowerCase());
  return {
    site: sites > 0,
    google: libs.some((l) => /fiche google|google business|avis|gbp/.test(l)),
    ads: libs.some((l) => /ads|publicit|campagne/.test(l)),
  };
}
