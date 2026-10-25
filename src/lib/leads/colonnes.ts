/** Les colonnes d'une liste de leads, dans l'ordre du fichier Excel de référence. */
export const COLONNES = [
  "Entreprise", "Secteur", "Ville", "Adresse", "Téléphone", "Email", "Site web", "Dirigeant", "Rôle", "Note Google", "Avis Google",
  "Score", "SIREN", "SIRET", "TVA intracom", "Forme juridique", "Code NAF", "Date de création", "État", "Établissements (total)",
  "Établissements ouverts", "Fiabilité identité", "CMS", "Hébergeur", "Âge domaine", "Vitesse mobile", "Vitesse desktop", "HTTPS",
  "Responsive", "Google Ads", "Score SEO", "Faiblesses SEO", "Facebook", "Instagram",
] as const;
export type Colonne = (typeof COLONNES)[number];
export type LeadRow = Partial<Record<Colonne, string | number | null>> & { _source?: string | null; _presence?: string | null };

/** Colonnes affichées par défaut dans le tableau (les autres restent dans l'export). */
export const COLONNES_PRINCIPALES: Colonne[] = ["Entreprise", "Ville", "Téléphone", "Site web", "Dirigeant", "Note Google", "Avis Google", "Score", "Faiblesses SEO"];

/** Statut d'une liste dans le coffre. */
export const LISTE_STATUT = {
  GENERATION: { label: "En génération", cls: "border-yellow/40 bg-yellow/10 text-yellow" },
  PRETE: { label: "Prête", cls: "border-green/40 bg-green/10 text-green" },
  UTILISEE: { label: "Utilisée", cls: "border-border bg-surface-2 text-text" },
  ERREUR: { label: "Erreur", cls: "border-pink/40 bg-pink/10 text-pink" },
} as const;
