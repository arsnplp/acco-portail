/** Connecteurs externes (section 00.7) : interrupteur, état, dernière synchro et journal d'erreurs, jamais bloquants. */
import { prisma } from "@/lib/prisma";
import { featureEnabled, type FeatureKey } from "@/lib/settings";

export type Connecteur = "gmail" | "calendar" | "aircall" | "search_console" | "business_profile" | "financier";
export const CONNECTEUR_LABEL: Record<Connecteur, string> = {
  gmail: "Gmail (lecture des échanges, envoi aux clients)", calendar: "Google Agenda", aircall: "Aircall (métadonnées d’appels)",
  search_console: "Google Search Console (SEO du portail, une fois par jour)", business_profile: "Fiche Google (avis)", financier: "Connecteur financier (bientôt disponible)",
};
const FEATURE: Record<Connecteur, FeatureKey> = { gmail: "feature_gmail", calendar: "feature_calendar", aircall: "feature_aircall", search_console: "feature_search_console", business_profile: "feature_business_api", financier: "feature_financier" };

export const connecteurActif = (c: Connecteur) => featureEnabled(FEATURE[c]);

export async function journal(connecteur: Connecteur, niveau: "info" | "erreur", message: string) {
  await prisma.connecteurLog.create({ data: { connecteur, niveau, message: message.slice(0, 500) } }).catch(() => null);
  if (niveau === "erreur") console.warn(`[${connecteur}]`, message);
}
export async function marquerSync(connecteur: Connecteur) {
  const key = `connecteur_${connecteur}_sync_at`;
  await prisma.setting.upsert({ where: { key }, create: { key, value: new Date().toISOString() }, update: { value: new Date().toISOString() } }).catch(() => null);
}
/** État affiché dans Administration : actif, dernière synchro, dernières erreurs. */
export async function etatConnecteurs() {
  const out = [] as { connecteur: Connecteur; label: string; actif: boolean; derniereSync: Date | null; erreurs: { message: string; createdAt: Date }[] }[];
  for (const c of Object.keys(CONNECTEUR_LABEL) as Connecteur[]) {
    const [actif, sync, erreurs] = await Promise.all([
      connecteurActif(c),
      prisma.setting.findUnique({ where: { key: `connecteur_${c}_sync_at` } }),
      prisma.connecteurLog.findMany({ where: { connecteur: c, niveau: "erreur" }, orderBy: { createdAt: "desc" }, take: 3, select: { message: true, createdAt: true } }),
    ]);
    out.push({ connecteur: c, label: CONNECTEUR_LABEL[c], actif, derniereSync: sync ? new Date(sync.value) : null, erreurs });
  }
  return out;
}
