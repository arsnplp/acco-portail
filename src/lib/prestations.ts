/**
 * Toutes les prestations ACCO, pas seulement celles mises en avant dans l'app (Fiche Google, Publicité, Blog).
 * Liste statique sans dépendance serveur : affichée dans Accompagnement → Nos services, chaque ligne a un bouton « Demander un devis ».
 */
import type { ArtKind } from "@/app/(client)/studio/art";

export type PrestationKey = "site" | "boutique" | "seo" | "geo" | "google" | "ads" | "meta" | "blog" | "brand" | "social" | "print" | "photo" | "strategy";
export type Prestation = { titre: string; texte: string; art: ArtKind; couleur: "blue" | "pink" | "yellow" | "green" };

export const PRESTATIONS: Record<PrestationKey, Prestation> = {
  site: { titre: "Site internet", texte: "Un site vitrine clair, rapide et à votre image, hébergé et maintenu par nos soins.", art: "brand", couleur: "blue" },
  boutique: { titre: "Boutique en ligne", texte: "Vendez vos produits ou prenez des réservations directement depuis votre site.", art: "create", couleur: "blue" },
  seo: { titre: "Référencement local (SEO)", texte: "Apparaissez dans les premiers résultats quand on cherche votre métier près de chez vous.", art: "strategy", couleur: "pink" },
  geo: { titre: "Visibilité dans les IA", texte: "Structurez votre site et vos contenus pour être compris et cité par ChatGPT, Gemini et les moteurs de réponse.", art: "strategy", couleur: "pink" },
  google: { titre: "Gestion de votre fiche Google", texte: "Optimisation, publications et suivi des avis pour faire venir plus d’appels et de visites.", art: "social", couleur: "pink" },
  ads: { titre: "Campagnes Google Ads", texte: "Touchez des clients qui recherchent déjà vos services, avec un budget que vous fixez.", art: "social", couleur: "pink" },
  meta: { titre: "Campagnes Meta Ads", texte: "Faites découvrir vos offres à de nouveaux publics sur Facebook et Instagram.", art: "create", couleur: "green" },
  blog: { titre: "Blog pour votre site", texte: "Des articles réguliers, rédigés et publiés par nos soins, pour développer votre visibilité.", art: "print", couleur: "blue" },
  brand: { titre: "Identité visuelle", texte: "Logo, couleurs, typographies : une identité cohérente et reconnaissable sur tous vos supports.", art: "brand", couleur: "yellow" },
  social: { titre: "Réseaux sociaux", texte: "Confiez-nous vos contenus et l’animation de vos réseaux, dans votre ton.", art: "social", couleur: "green" },
  print: { titre: "Création graphique et impression", texte: "Flyers, affiches, cartes de visite : des supports sur mesure, conçus par notre équipe.", art: "print", couleur: "yellow" },
  photo: { titre: "Photo et vidéo", texte: "Des images professionnelles de votre activité, pour votre site et vos réseaux.", art: "photo", couleur: "green" },
  strategy: { titre: "Accompagnement marketing", texte: "Faites le point avec un expert sur votre stratégie, vos clients et vos prochaines opportunités.", art: "strategy", couleur: "yellow" },
};

/** Classe Tailwind du point de couleur (écrite en clair pour que Tailwind la génère). */
export const POINT: Record<Prestation["couleur"], string> = { blue: "bg-blue", pink: "bg-pink", yellow: "bg-yellow", green: "bg-green" };
export const PRESTATION_KEYS = Object.keys(PRESTATIONS) as PrestationKey[];
/** Les deux prestations mises en avant sur la page Accompagnement. */
export const PRESTATIONS_EN_AVANT: PrestationKey[] = ["strategy", "photo"];
