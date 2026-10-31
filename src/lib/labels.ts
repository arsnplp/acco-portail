import type { ChangeRequestStatus, Formule, ProjectStep, SiteStatus, ContactRequestStatus, Urgency } from "@prisma/client";
import type { Tone } from "@/components/ui/badge";

export const SITE_STATUS: Record<SiteStatus, { label: string; tone: Tone }> = {
  EN_CREATION: { label: "En création", tone: "yellow" },
  EN_LIGNE: { label: "En ligne", tone: "green" },
  SUSPENDU: { label: "Suspendu", tone: "pink" },
};

/** Les 6 étapes de production (colonnes du kanban « Sites en cours »), avec le texte montré au client et l'échéance qui compte. */
export const PROJECT_STEPS: Array<{ key: ProjectStep; label: string; court: string; client: string; deadline: "deadlineV1" | "deadlineV2" | "deadlineLivraison" }> = [
  { key: "MAQUETTE", label: "Maquette", court: "Maquette", client: "Nous préparons la maquette de votre site à partir de notre échange.", deadline: "deadlineV1" },
  { key: "ATTENTE_VALIDATION", label: "Attente de validation", court: "Validation", client: "Votre maquette est prête : regardez-la et validez-la pour que nous passions aux modifications.", deadline: "deadlineV1" },
  { key: "MODIFICATION", label: "Modification", court: "Modifs", client: "Nous modifions votre site à partir de vos retours.", deadline: "deadlineV2" },
  { key: "ATTENTE_VALIDATION_FINITION", label: "Attente de validation et finition", court: "Finition", client: "La nouvelle version vous attend : vérifiez-la et dites-nous si tout est bon, nous finalisons ensuite.", deadline: "deadlineV2" },
  { key: "A_LIVRER", label: "À livrer", court: "Livraison", client: "Dernières vérifications avant la mise en ligne.", deadline: "deadlineLivraison" },
];
export const stepLabel = (s: ProjectStep) => PROJECT_STEPS.find((p) => p.key === s)?.label ?? s;

export const ARTICLE_STATUT: Record<"A_REDIGER" | "A_PUBLIER" | "PUBLIE", { label: string; tone: Tone }> = {
  A_REDIGER: { label: "À rédiger", tone: "neutral" },
  A_PUBLIER: { label: "À publier", tone: "yellow" },
  PUBLIE: { label: "Publié", tone: "green" },
};

export const CHANGE_STATUS: Record<ChangeRequestStatus, { label: string; tone: Tone }> = {
  RECUE: { label: "Reçue", tone: "pink" },
  EN_COURS: { label: "En cours", tone: "yellow" },
  A_VALIDER: { label: "À valider", tone: "claude" },
  TERMINEE: { label: "Terminée", tone: "green" },
};

/** Côté client, « À valider » (relecture interne) s'affiche comme « En cours ». */
export type ClientChangeStatus = "RECUE" | "EN_COURS" | "TERMINEE";
export const clientChangeStatus = (s: ChangeRequestStatus): ClientChangeStatus => (s === "A_VALIDER" ? "EN_COURS" : s);

export const URGENCY: Record<Urgency, string> = { NORMALE: "Quand vous pouvez", URGENTE: "Urgent" };

export const CONTACT_STATUS: Record<ContactRequestStatus, { label: string; tone: Tone }> = {
  NOUVELLE: { label: "À traiter", tone: "pink" },
  TRAITEE: { label: "Traitée", tone: "green" },
  DEVENU_CLIENT: { label: "Devenu client", tone: "blue" },
};

export const FORMULE: Record<Formule, { label: string; tone: Tone }> = {
  ESSENTIEL: { label: "Essentiel", tone: "neutral" },
  REFERENCE: { label: "Référence", tone: "blue" },
  CONQUETE: { label: "Conquête", tone: "yellow" },
  SIGNATURE: { label: "Signature", tone: "claude" },
};

export const SITE_PAGES = ["Accueil", "À propos", "Services / Produits", "Galerie", "Tarifs", "Contact", "Mentions légales", "Autre"];
