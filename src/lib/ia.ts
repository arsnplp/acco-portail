/**
 * Garde-fous IA (section 00.6) : désactivée par défaut, uniquement à la demande (jamais au chargement ni en tâche de fond),
 * plafond mensuel de dépense, compteur par fonctionnalité, modèle le moins coûteux suffisant.
 */
import { prisma } from "@/lib/prisma";
import { featureEnabled, getSecret } from "@/lib/settings";

export type FonctionIA = "recap" | "avis_reponse" | "conseils" | "enrichissement" | "leads" | "synthese_client" | "brouillon_email" | "resume_cr" | "blog" | "resume_appel";
export const FONCTION_LABEL: Record<FonctionIA, string> = {
  recap: "Récap mensuel rédigé", avis_reponse: "Réponse proposée aux avis", conseils: "Conseils business du portail", enrichissement: "Générer les infos (recherche web)",
  leads: "Coffre à leads (recherche web)", synthese_client: "Synthèse de fiche client", brouillon_email: "Brouillons d’emails", resume_cr: "Résumé de compte rendu", blog: "Articles de blog (rédaction SEO, sujets proposés)",
  resume_appel: "Résumé des appels Aircall quand Aircall n’en fournit pas (à partir de la transcription, modèle léger)",
};
/** Modèle par défaut : le moins coûteux suffisant pour des textes courts ; les leads gardent LEADS_MODEL. */
export const MODELE_LEGER = process.env.IA_MODELE_LEGER ?? "claude-haiku-5-5";
/** Prix indicatifs par million de jetons (entrée, sortie), en centimes. */
const PRIX: Record<string, [number, number]> = { "claude-haiku-5-5": [100, 500], "claude-sonnet-5-5": [300, 1500], "claude-opus-5-5": [1500, 7500] };

export async function plafondCents() {
  const row = await prisma.setting.findUnique({ where: { key: "ia_plafond_cents" } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 ? n : 2000;
}
export function debutMois(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
export async function usageDuMois(now = new Date()) {
  const rows = await prisma.usageIA.groupBy({ by: ["fonction"], where: { createdAt: { gte: debutMois(now) } }, _count: true, _sum: { coutCents: true } });
  const total = rows.reduce((a, r) => a + (r._sum.coutCents ?? 0), 0);
  return { total, appels: rows.reduce((a, r) => a + r._count, 0), parFonction: rows.map((r) => ({ fonction: r.fonction as FonctionIA, appels: r._count, coutCents: r._sum.coutCents ?? 0 })) };
}
/** L'IA est-elle utilisable pour cette fonction maintenant ? (interrupteur général + interrupteur de la fonction + plafond + clé). */
export async function iaAutorisee(fonction: FonctionIA): Promise<{ ok: true } | { ok: false; raison: string }> {
  if (!(await featureEnabled("feature_ai"))) return { ok: false, raison: "L’IA est désactivée (Administration → IA et intégrations)." };
  const fn = await prisma.setting.findUnique({ where: { key: `ia_${fonction}` } });
  if (fn?.value !== "true") return { ok: false, raison: `La fonction « ${FONCTION_LABEL[fonction]} » est désactivée.` };
  if (!(await getSecret("anthropic_api_key"))) return { ok: false, raison: "Aucune clé Anthropic." };
  const [plafond, usage] = await Promise.all([plafondCents(), usageDuMois()]);
  if (plafond > 0 && usage.total >= plafond) return { ok: false, raison: `Plafond mensuel IA atteint (${(usage.total / 100).toFixed(2)} € sur ${(plafond / 100).toFixed(2)} €). L’IA se réactive le mois prochain.` };
  return { ok: true };
}
export function coutCents(modele: string, inputTokens: number, outputTokens: number) {
  const [pin, pout] = PRIX[modele] ?? PRIX["claude-sonnet-5-5"];
  return Math.round((inputTokens * pin + outputTokens * pout) / 1_000_000);
}
/** À appeler après chaque réponse de l'API. */
export async function enregistrerUsageIA(fonction: FonctionIA, modele: string, usage: { input_tokens?: number; output_tokens?: number } | null | undefined, userId?: string | null, extraCents = 0) {
  const i = usage?.input_tokens ?? 0, o = usage?.output_tokens ?? 0;
  await prisma.usageIA.create({ data: { fonction, modele, inputTokens: i, outputTokens: o, coutCents: coutCents(modele, i, o) + extraCents, userId: userId ?? null } }).catch((e) => console.warn("[ia] usage", (e as Error).message));
}
