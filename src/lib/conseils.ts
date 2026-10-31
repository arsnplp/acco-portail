/**
 * Conseils business pour l'espace client : recommandations automatiques à partir de ce qu'on sait du site
 * (fiche Google, avis, blog, réseaux sociaux, demandes reçues), reformulées par Claude si une clé est présente.
 * Calculés au plus une fois par semaine et par site (Site.conseils).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai";
import { getSecret } from "@/lib/settings";
import type { LeadRow } from "@/lib/leads/colonnes";

export type Conseil = { id: string; titre: string; texte: string; priorite: 1 | 2 | 3; href?: string | null; externe?: boolean };

export async function conseilsPourSite(siteId: string, force = false): Promise<Conseil[]> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { client: { select: { name: true, gmbUrl: true, crmProspect: { select: { infos: true, lead: { select: { donnees: true } } } } } }, articles: { where: { statut: "PUBLIE" }, orderBy: { publieAt: "desc" }, take: 1 }, reviews: { orderBy: { publishedAt: "desc" }, take: 1 }, _count: { select: { contactRequests: { where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } } } } },
  });
  if (!site) return [];
  if (!force && site.conseils && site.conseilsAt && Date.now() - site.conseilsAt.getTime() < 7 * 86400_000) return site.conseils as unknown as Conseil[];

  const infos = (site.client.crmProspect?.infos ?? site.client.crmProspect?.lead?.donnees ?? null) as LeadRow | null;
  const j = (d: Date | null | undefined) => (d ? Math.floor((Date.now() - d.getTime()) / 86400_000) : null);
  const dernierAvis = j(site.reviews[0]?.publishedAt), dernierArticle = j(site.articles[0]?.publieAt);
  const gmb = !!(site.client.gmbUrl || site.googleLocationId);
  const regles: Conseil[] = [];
  if (!gmb) regles.push({ id: "gmb", titre: "Créez (ou reliez) votre fiche Google", texte: "C’est la première chose que vos clients voient quand ils cherchent votre activité près de chez eux : adresse, horaires, photos, avis. Sans fiche, vous êtes invisible sur Google Maps.", priorite: 1, href: "https://www.google.com/business/", externe: true });
  else regles.push({ id: "gmb-post", titre: "Postez une actualité sur votre fiche Google", texte: "Une photo ou une info par semaine (nouveauté, promo, horaires) garde votre fiche vivante et la fait remonter dans Google Maps.", priorite: 2, href: site.client.gmbUrl ?? "https://business.google.com/", externe: true });
  if ((site.reviewTotal ?? 0) < 20 || dernierAvis === null || dernierAvis > 45) regles.push({ id: "avis", titre: "Lancez une campagne de demande d’avis", texte: `${site.reviewTotal ? `Vous avez ${site.reviewTotal} avis` : "Vous avez peu d’avis"}${dernierAvis !== null ? `, le dernier date d’il y a ${dernierAvis} jours` : ""}. Demandez un avis à chaque client satisfait : un message, un QR code en caisse, un mail après la prestation.`, priorite: 1, href: `/sites/${siteId}/avis` });
  if (dernierArticle === null || dernierArticle > 60) regles.push({ id: "blog", titre: "Publiez un article sur votre site", texte: "Un article par mois (conseils, coulisses, réponses aux questions fréquentes) apporte de nouvelles visites depuis Google. Dites-nous le sujet, nous nous occupons du reste.", priorite: 2, href: `/sites/${siteId}/modifications` });
  if (infos && !infos.Facebook && !infos.Instagram) regles.push({ id: "reseaux", titre: "Animez vos réseaux sociaux", texte: "Aucune page Facebook ou Instagram trouvée. Une page simple avec vos réalisations et vos horaires rassure et renvoie vers votre site.", priorite: 2 });
  else regles.push({ id: "reseaux-post", titre: "Partagez votre site sur vos réseaux", texte: "Publiez un lien vers votre site ou votre dernier article sur Facebook et Instagram : chaque partage amène des visites et des contacts.", priorite: 3 });
  if (!infos?._source || !/pages ?jaunes/i.test(String(infos._source))) regles.push({ id: "pagesjaunes", titre: "Créez votre fiche Pages Jaunes", texte: "Gratuite et encore très consultée : nom, téléphone, horaires et lien vers votre site. Un annuaire de plus qui renforce votre présence locale.", priorite: 3, href: "https://www.pagesjaunes.fr/inscription", externe: true });
  if (site._count.contactRequests === 0) regles.push({ id: "contact", titre: "Mettez en avant votre formulaire de contact", texte: "Aucune demande reçue via le site ces 30 derniers jours. Un bouton « Demander un devis » bien visible, votre numéro en haut de page et un rappel sur vos réseaux changent tout.", priorite: 2, href: `/sites/${siteId}/modifications` });
  const conseils = regles.sort((a, b) => a.priorite - b.priorite).slice(0, 5);

  const final = (await aiConfigured()) ? await personnaliser(conseils, site.client.name, infos?.Secteur ? String(infos.Secteur) : null).catch((e) => { console.warn("[conseils]", (e as Error).message); return conseils; }) : conseils;
  await prisma.site.update({ where: { id: siteId }, data: { conseils: final as unknown as Prisma.InputJsonValue, conseilsAt: new Date() } }).catch(() => null);
  return final;
}

/** Claude reformule les textes pour le commerçant (ton simple, concret), sans inventer de chiffres. */
async function personnaliser(conseils: Conseil[], commerce: string, secteur: string | null): Promise<Conseil[]> {
  const client = new Anthropic({ apiKey: (await getSecret("anthropic_api_key")) ?? undefined, timeout: 60_000 });
  const res = await client.messages.create({
    model: "claude-sonnet-5-5", max_tokens: 1500,
    system: "Tu écris pour un commerçant ou artisan français, pas technique. Tu reçois des conseils (titre, texte) avec les faits connus. Reformule chaque texte en 2 phrases max, concrètes, chaleureuses, adaptées à son métier, sans jargon (jamais « SEO », « CTR »), sans inventer de chiffres ni de faits. Garde les ids et les titres. Réponds uniquement avec un JSON : {\"conseils\":[{\"id\":\"…\",\"texte\":\"…\"}]}",
    messages: [{ role: "user", content: `Commerce : ${commerce}${secteur ? ` (${secteur})` : ""}\n\n${conseils.map((c) => `- id ${c.id} · ${c.titre} : ${c.texte}`).join("\n")}` }],
  });
  const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { conseils?: { id: string; texte: string }[] };
  return conseils.map((c) => ({ ...c, texte: json.conseils?.find((x) => x.id === c.id)?.texte?.trim() || c.texte }));
}
