/** Champs « Informations du client » du générateur de contrat (partagés formulaire / serveur, sans dépendance serveur). */
export type InfosClient = { nom: string; forme: string; adresse: string; siret: string; rcs: string; capital: string; representant: string; fonction: string; email: string };
export const INFOS_CLIENT_CHAMPS: { key: keyof InfosClient; label: string; requis: boolean; aide?: string }[] = [
  { key: "nom", label: "Raison sociale", requis: true }, { key: "forme", label: "Forme juridique", requis: true, aide: "SASU, SARL, EI, auto-entrepreneur…" }, { key: "adresse", label: "Adresse du siège", requis: true },
  { key: "siret", label: "SIREN / SIRET", requis: true }, { key: "rcs", label: "Ville du RCS", requis: false }, { key: "capital", label: "Capital (€)", requis: false },
  { key: "representant", label: "Signataire (prénom et nom)", requis: true }, { key: "fonction", label: "Fonction du signataire", requis: true, aide: "gérant, président…" }, { key: "email", label: "Email du signataire", requis: true },
];
