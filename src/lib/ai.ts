import Anthropic from "@anthropic-ai/sdk";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type RecapInput = {
  siteName: string; monthLabel: string;
  clicks: number; prevClicks: number | null; impressions: number; prevImpressions: number | null; position: number; prevPosition: number | null;
  contactCount: number; reviewCount: number; topQueries: { query: string; clicks: number }[];
};

const pct = (a: number, b: number | null) => (b === null || b === 0 ? null : Math.round(((a - b) / b) * 100));

/** Résumé de 3 phrases, en français simple. Claude si la clé est présente, sinon un gabarit (mode développement). */
export async function summarizeMonth(d: RecapInput): Promise<string> {
  if (!aiConfigured()) return templateSummary(d);
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 300,
      system: "Tu écris pour un commerçant ou artisan français, pas du tout technique. Exactement 3 phrases courtes, chaleureuses, sans jargon (jamais « CTR », « impressions », « SEO », « dashboard »). Dis « visites depuis Google », « apparitions dans les résultats », « demandes de clients ». Pas de liste, pas d'emoji, pas de titre.",
      messages: [{ role: "user", content: `Site : ${d.siteName}. Mois : ${d.monthLabel}.\nVisites depuis Google : ${d.clicks} (mois précédent : ${d.prevClicks ?? "inconnu"}).\nApparitions dans Google : ${d.impressions} (précédent : ${d.prevImpressions ?? "inconnu"}).\nPosition moyenne : ${d.position} (précédent : ${d.prevPosition ?? "inconnu"}).\nDemandes de clients reçues via le site : ${d.contactCount}.\nNouveaux avis Google : ${d.reviewCount}.\nRecherches qui amènent le plus de visites : ${d.topQueries.slice(0, 3).map((q) => `« ${q.query} »`).join(", ") || "aucune"}.\n\nRédige le résumé du mois.` }],
    });
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join(" ").trim();
    return text || templateSummary(d);
  } catch (e) {
    console.warn("[ai] résumé impossible, gabarit utilisé :", (e as Error).message);
    return templateSummary(d);
  }
}

export function templateSummary(d: RecapInput) {
  const v = pct(d.clicks, d.prevClicks);
  const s1 = v === null
    ? `En ${d.monthLabel}, ${d.clicks} personnes sont arrivées sur ${d.siteName} depuis Google.`
    : v >= 5 ? `Bon mois pour ${d.siteName} : ${d.clicks} visites depuis Google, soit ${v} % de plus qu’en ${prevLabel(d.monthLabel)}.`
    : v <= -5 ? `${d.siteName} a reçu ${d.clicks} visites depuis Google en ${d.monthLabel}, un peu moins que le mois précédent (${Math.abs(v)} % de baisse).`
    : `${d.siteName} a reçu ${d.clicks} visites depuis Google en ${d.monthLabel}, comme le mois précédent.`;
  const s2 = d.contactCount > 0
    ? `Votre site vous a apporté ${d.contactCount} demande${d.contactCount > 1 ? "s" : ""} de clients${d.reviewCount > 0 ? ` et ${d.reviewCount} nouvel${d.reviewCount > 1 ? "s" : ""} avis Google` : ""}.`
    : d.reviewCount > 0 ? `Vous avez reçu ${d.reviewCount} nouvel${d.reviewCount > 1 ? "s" : ""} avis Google ce mois-ci.` : `Votre site est apparu ${d.impressions.toLocaleString("fr-FR")} fois dans les résultats Google.`;
  const top = d.topQueries[0];
  const s3 = top ? `La recherche qui vous amène le plus de monde est « ${top.query} ».` : `Continuez à alimenter votre fiche Google et vos photos pour progresser.`;
  return `${s1} ${s2} ${s3}`;
}

function prevLabel(monthLabel: string) {
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const [m, y] = monthLabel.split(" ");
  const i = months.indexOf(m);
  if (i < 0) return "le mois précédent";
  return i === 0 ? `décembre ${Number(y) - 1}` : `${months[i - 1]} ${y}`;
}

/** Réponse proposée à un avis (étape 7). */
export async function suggestReviewReply(opts: { businessName: string; authorName: string; rating: number; text: string | null }) {
  const fallback = opts.rating >= 4
    ? `Merci beaucoup ${opts.authorName} pour votre retour ! Toute l’équipe de ${opts.businessName} est ravie de vous avoir accueilli·e. À très bientôt !`
    : `Bonjour ${opts.authorName}, merci d’avoir pris le temps de nous écrire. Nous sommes désolés que votre expérience n’ait pas été à la hauteur. N’hésitez pas à nous contacter directement pour que nous puissions arranger cela. L’équipe de ${opts.businessName}.`;
  if (!aiConfigured()) return fallback;
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 250,
      system: "Tu réponds aux avis Google au nom d'un commerçant français. Ton chaleureux, simple, 2 à 4 phrases, tutoiement interdit, pas d'emoji, pas de promesse commerciale. Si l'avis est négatif : excuses sincères, proposition de contact direct, jamais de justification agressive.",
      messages: [{ role: "user", content: `Commerce : ${opts.businessName}\nAuteur : ${opts.authorName}\nNote : ${opts.rating}/5\nAvis : ${opts.text ?? "(sans texte)"}\n\nRédige la réponse.` }],
    });
    return res.content.filter((c) => c.type === "text").map((c) => c.text).join(" ").trim() || fallback;
  } catch {
    return fallback;
  }
}
