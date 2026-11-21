/** Libellés des difficultés (partagés client / équipe, sans dépendance serveur). */
import type { DifficulteStatut, DifficulteType } from "@prisma/client";

export const DIFFICULTE_TYPE: Record<DifficulteType, { label: string; aide: string }> = {
  SITE_EN_PANNE: { label: "Mon site ne marche plus", aide: "page blanche, erreur, site inaccessible" },
  ERREUR_SITE: { label: "Une erreur sur mon site", aide: "faute, mauvaise info, bouton cassé, photo manquante" },
  FACTURE: { label: "Facture ou paiement", aide: "montant, prélèvement, facture introuvable" },
  AUTRE: { label: "Autre chose", aide: "tout le reste, on vous répond vite" },
};
export const DIFFICULTE_STATUT: Record<DifficulteStatut, { label: string; tone: "yellow" | "blue" | "green" }> = {
  RECUE: { label: "Reçue", tone: "yellow" },
  EN_COURS: { label: "En cours", tone: "blue" },
  RESOLUE: { label: "Résolue", tone: "green" },
};
/** Délai de réponse annoncé au client, selon le type. */
export const DELAI_REPONSE: Record<DifficulteType, string> = { SITE_EN_PANNE: "sous 4 h ouvrées", ERREUR_SITE: "sous 24 h ouvrées", FACTURE: "sous 48 h ouvrées", AUTRE: "sous 48 h ouvrées" };
