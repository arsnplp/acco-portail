import type { CurrentUser } from "@/lib/auth";

/** Contexte commun aux onglets de la fiche client. */
export type Ctx = { clientId: string; me: CurrentUser; finance: boolean; externe: boolean; sp: { canal?: string; site?: string; qui?: string; periode?: string; contact?: string } };
export const lien = (clientId: string, onglet: string) => `/admin/clients/${clientId}?onglet=${onglet}`;

export const ONGLETS = [
  ["apercu", "Vue d’ensemble"], ["sites", "Sites"], ["contrats", "Contrats et abonnements"], ["contacts", "Contacts"], ["activite", "Activité"],
  ["emails", "Emails"], ["appels", "Appels"], ["taches", "Tâches & RDV"], ["demandes", "Demandes"], ["documents", "Documents"], ["intelligence", "Intelligence client"], ["satisfaction", "Satisfaction et parrainage"],
] as const;
export type Onglet = (typeof ONGLETS)[number][0];
