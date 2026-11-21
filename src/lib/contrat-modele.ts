/**
 * Modèle de contrat : texte des articles, modifiable dans Paramètres → Contrats (clé Setting `contrat_modele`),
 * avec des variables {{…}} remplacées à la génération du PDF. Un article commence par une ligne `## Titre`.
 * Les coordonnées de l'agence sont aussi des réglages (adresse, SIRET), avec des valeurs par défaut.
 */
import { prisma } from "@/lib/prisma";

export const AGENCE_DEFAUT = { nom: "ACCO LAB", adresse: "47 RUE VIVIENNE 75002 PARIS", siret: "10446016700018", forme: "SAS", representant: "", email: "contact@acco-lab.fr" };
export const AGENCE_KEYS = { nom: "agence_nom", adresse: "agence_adresse", siret: "agence_siret", forme: "agence_forme", representant: "agence_representant", email: "agence_email" } as const;

export const VARIABLES_CONTRAT: [string, string][] = [
  ["{{client.nom}}", "raison sociale du client"], ["{{client.forme}}", "forme juridique"], ["{{client.adresse}}", "adresse"], ["{{client.siret}}", "SIREN / SIRET"],
  ["{{client.representant}}", "signataire"], ["{{client.fonction}}", "sa fonction"], ["{{client.email}}", "email"],
  ["{{agence.nom}}", "ACCO LAB"], ["{{agence.adresse}}", "adresse de l’agence"], ["{{agence.siret}}", "SIRET de l’agence"],
  ["{{prestations}}", "liste des prestations"], ["{{mensuel}}", "total mensuel HT"], ["{{ponctuel}}", "total ponctuel HT"], ["{{formule}}", "formule"],
  ["{{duree}}", "durée d’engagement (mois)"], ["{{reconduction}}", "reconduction (mois)"], ["{{preavis}}", "préavis (jours)"], ["{{debut}}", "début d’engagement"], ["{{fin}}", "fin d’engagement"],
  ["{{paiement}}", "moyen de paiement"], ["{{commercial}}", "interlocuteur ACCO"], ["{{date}}", "date du jour"], ["{{reference}}", "référence du contrat"],
];

export const CONTRAT_MODELE_DEFAUT = `## Article 1 - Objet
Le présent contrat a pour objet la fourniture par {{agence.nom}} au Client des prestations de services digitaux décrites ci-dessus : {{prestations}}.

## Article 2 - Durée et reconduction
Le contrat est conclu pour une durée d'engagement de {{duree}} mois à compter du {{debut}}{{fin_phrase}}. À l'issue de cette période, il est reconduit tacitement par périodes de {{reconduction}} mois, sauf dénonciation par l'une des parties par lettre recommandée avec accusé de réception au moins {{preavis}} jours avant l'échéance.

## Article 3 - Prix et modalités de paiement
En contrepartie des prestations, le Client verse à {{agence.nom}} un abonnement mensuel de {{mensuel}} HT{{ponctuel_phrase}}, TVA en sus au taux en vigueur. Moyen de paiement : {{paiement}}. La première mensualité est due à la signature ; la production démarre à réception du premier règlement. Tout retard de paiement entraîne de plein droit des pénalités au taux légal et une indemnité forfaitaire de recouvrement de 40 euros.

## Article 4 - Obligations du Prestataire
{{agence.nom}} s'engage à réaliser les prestations avec soin et selon les règles de l'art, à héberger et maintenir le site pendant toute la durée du contrat, et à informer le Client de toute difficulté. {{agence.nom}} est tenu à une obligation de moyens.

## Article 5 - Obligations du Client
Le Client fournit dans les délais convenus les éléments nécessaires à la réalisation des prestations (textes, images, logo, accès) et garantit qu'il détient les droits sur ces éléments. Il valide les étapes (brief, maquette, mise en ligne) dans un délai raisonnable.

## Article 6 - Propriété intellectuelle
Le Client est propriétaire de son nom de domaine et des contenus qu'il fournit. Les créations réalisées par {{agence.nom}} restent sa propriété jusqu'au complet paiement des sommes dues ; à l'issue de l'engagement et sous réserve du paiement intégral, le Client dispose d'un droit d'usage du site. Les outils, modèles et savoir-faire de {{agence.nom}} restent sa propriété.

## Article 7 - Évolutions
Toute évolution de la formule ou des prestations fait l'objet d'un avenant signé, applicable à la prochaine échéance mensuelle. Aucune diminution de formule n'est possible pendant la période d'engagement.

## Article 8 - Résiliation
En cas de manquement grave de l'une des parties non réparé dans un délai de 30 jours après mise en demeure, l'autre partie peut résilier le contrat de plein droit. En cas de résiliation anticipée par le Client, les mensualités restant dues jusqu'à la fin de l'engagement sont exigibles.

## Article 9 - Données personnelles et confidentialité
Chaque partie s'engage à respecter la réglementation applicable à la protection des données personnelles et à garder confidentielles les informations échangées dans le cadre du contrat.

## Article 10 - Acceptation et litiges
Le Client accepte le présent contrat par signature manuscrite ou par acceptation en ligne (identification par email et code à usage unique), qui vaut signature ; l'empreinte numérique du document accepté est conservée avec le certificat de preuve. Le contrat est soumis au droit français. À défaut d'accord amiable, les tribunaux compétents sont ceux du siège de {{agence.nom}}.`;

export async function reglagesContrat() {
  const rows = await prisma.setting.findMany({ where: { key: { in: ["contrat_modele", ...Object.values(AGENCE_KEYS)] } } });
  const g = (k: string) => rows.find((r) => r.key === k)?.value?.trim() || "";
  return {
    modele: g("contrat_modele") || CONTRAT_MODELE_DEFAUT,
    agence: { nom: g(AGENCE_KEYS.nom) || AGENCE_DEFAUT.nom, adresse: g(AGENCE_KEYS.adresse) || AGENCE_DEFAUT.adresse, siret: g(AGENCE_KEYS.siret) || AGENCE_DEFAUT.siret, forme: g(AGENCE_KEYS.forme) || AGENCE_DEFAUT.forme, representant: g(AGENCE_KEYS.representant) || AGENCE_DEFAUT.representant, email: g(AGENCE_KEYS.email) || AGENCE_DEFAUT.email },
  };
}

/** Remplace les {{variables}} ; une variable inconnue reste vide. */
export function rendreModele(texte: string, vars: Record<string, string>) {
  return texte.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/** Découpe le modèle rendu en articles : `## Titre` puis le corps. Le texte avant le premier titre devient un préambule sans titre. */
export function articlesDuModele(texte: string): [string, string][] {
  const out: [string, string][] = [];
  let titre = "", corps: string[] = [];
  const flush = () => { if (titre || corps.join("").trim()) out.push([titre, corps.join("\n").trim()]); };
  for (const ligne of texte.split(/\r?\n/)) {
    const m = ligne.match(/^##\s+(.+)$/);
    if (m) { flush(); titre = m[1].trim(); corps = []; } else corps.push(ligne);
  }
  flush();
  return out;
}
