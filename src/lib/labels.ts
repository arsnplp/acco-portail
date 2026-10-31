import type { ChangeRequestStatus, Formule, ProjectStep, SiteStatus, ContactRequestStatus, Urgency } from "@prisma/client";
import type { Tone } from "@/components/ui/badge";

export const SITE_STATUS: Record<SiteStatus, { label: string; tone: Tone }> = {
  EN_CREATION: { label: "En création", tone: "yellow" },
  EN_LIGNE: { label: "En ligne", tone: "green" },
  SUSPENDU: { label: "Suspendu", tone: "pink" },
};

export const PROJECT_STEPS: Array<{ key: ProjectStep; label: string }> = [
  { key: "BRIEF", label: "Brief" },
  { key: "MAQUETTE", label: "Maquette" },
  { key: "DEVELOPPEMENT", label: "Développement" },
  { key: "MISE_EN_LIGNE", label: "Mise en ligne" },
];

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
