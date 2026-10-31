import type { ChangeRequestStatus, Formule, ProjectStep, SiteStatus, ContactRequestStatus, Urgency } from "@prisma/client";
import type { Tone } from "@/components/ui/badge";

export const SITE_STATUS: Record<SiteStatus, { label: string; tone: Tone }> = {
  EN_CREATION: { label: "En création", tone: "yellow" },
  EN_LIGNE: { label: "En ligne", tone: "green" },
  SUSPENDU: { label: "Suspendu", tone: "pink" },
};

/** Les 6 étapes de production (colonnes du kanban « Sites en cours »), avec le texte montré au client et l'échéance qui compte. */
export const PROJECT_STEPS: Array<{ key: ProjectStep; label: string; court: string; client: string; deadline: "deadlineV1" | "deadlineV2" | "deadlineLivraison" }> = [
  { key: "PREPARATION_V1", label: "Préparation V1", court: "Prépa V1", client: "Nous préparons la première version de votre site à partir de notre échange.", deadline: "deadlineV1" },
  { key: "PRESENTATION_V1", label: "Présentation V1", court: "Présentation", client: "Votre première version est prête : regardez-la et validez-la pour que nous passions au peaufinement.", deadline: "deadlineV1" },
  { key: "PEAUFINEMENT", label: "Peaufinement", court: "Peaufinement", client: "Nous peaufinons votre site à partir de vos retours.", deadline: "deadlineV2" },
  { key: "VALIDATION_CLIENT", label: "Validation client", court: "Validation", client: "La version 2 vous attend : vérifiez-la et dites-nous si tout est bon.", deadline: "deadlineV2" },
  { key: "FINITION", label: "Finition", court: "Finition", client: "Derniers réglages avant la livraison.", deadline: "deadlineLivraison" },
  { key: "LIVRAISON", label: "Livraison", court: "Livraison", client: "Livraison imminente : dernières vérifications avant la mise en ligne.", deadline: "deadlineLivraison" },
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
