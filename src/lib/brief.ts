/**
 * Brief collaboratif (10.3) : ouvert à la signature, rempli par le commercial puis complété par le client depuis son portail.
 * Chaque section a un état explicite (attendu / reçu / incomplet / validé) ; double validation commercial + technique avant production ;
 * Arsène peut déroger aux points non essentiels (carte blanche), jamais aux informations critiques.
 */
import { prisma } from "@/lib/prisma";

export type EtatSection = "ATTENDU" | "RECU" | "INCOMPLET" | "VALIDE";
export const ETAT_SECTION: Record<EtatSection, { label: string; tone: "yellow" | "blue" | "pink" | "green" }> = { ATTENDU: { label: "Attendu", tone: "yellow" }, RECU: { label: "Reçu", tone: "blue" }, INCOMPLET: { label: "Incomplet", tone: "pink" }, VALIDE: { label: "Validé", tone: "green" } };
export const BRIEF_SECTIONS: Array<{ key: string; label: string; aide: string; essentiel: boolean; client: boolean }> = [
  { key: "activite", label: "Activité et entreprise", aide: "Ce que fait l’entreprise, depuis quand, ce qui la distingue.", essentiel: true, client: true },
  { key: "cibles", label: "Clients visés", aide: "À qui s’adresse le site : particuliers, professionnels, zone géographique.", essentiel: false, client: true },
  { key: "pages", label: "Pages souhaitées", aide: "Accueil, services, galerie, contact… et ce que chacune doit contenir.", essentiel: true, client: true },
  { key: "textes", label: "Textes", aide: "Présentation, services, mentions utiles. Le client peut les déposer dans Documents.", essentiel: true, client: true },
  { key: "photos", label: "Photos et logo", aide: "Logo, photos de l’équipe, des réalisations, du local.", essentiel: false, client: true },
  { key: "preferences", label: "Préférences de style", aide: "Couleurs, ambiance, sites aimés ou détestés.", essentiel: false, client: true },
  { key: "concurrents", label: "Concurrents et références", aide: "Sites de concurrents ou de confrères à regarder.", essentiel: false, client: true },
  { key: "contacts", label: "Coordonnées à afficher", aide: "Adresse, téléphone, email, horaires, réseaux sociaux.", essentiel: true, client: true },
  { key: "legal", label: "Informations légales et techniques", aide: "Raison sociale, SIREN, TVA, nom de domaine, hébergement actuel, accès existants.", essentiel: true, client: false },
];
export type Section = { texte: string; etat: EtatSection; majAt?: string; par?: string };
export type ContenuBrief = Record<string, Section>;

export const lireContenu = (json: unknown): ContenuBrief => (json && typeof json === "object" ? (json as ContenuBrief) : {});
export const sectionDe = (c: ContenuBrief, key: string): Section => c[key] ?? { texte: "", etat: "ATTENDU" };

/** Le brief est-il complet : toutes les sections essentielles validées, et les autres validées ou couvertes par la dérogation ? */
export function completude(c: ContenuBrief, derogation: boolean) {
  const manquantes = BRIEF_SECTIONS.filter((s) => sectionDe(c, s.key).etat !== "VALIDE");
  const essentielles = manquantes.filter((s) => s.essentiel);
  return { manquantes, essentielles, complet: essentielles.length === 0 && (derogation || manquantes.length === 0) };
}

export async function chargerBrief(siteId: string) {
  return prisma.brief.upsert({ where: { siteId }, create: { siteId }, update: {} });
}
export async function majSection(siteId: string, key: string, patch: Partial<Section>, par: string) {
  if (!BRIEF_SECTIONS.some((s) => s.key === key)) return;
  const b = await chargerBrief(siteId);
  const c = lireContenu(b.contenu);
  const avant = sectionDe(c, key);
  const texte = patch.texte ?? avant.texte;
  const etat: EtatSection = patch.etat ?? (texte.trim() ? (avant.etat === "VALIDE" ? "VALIDE" : "RECU") : "ATTENDU");
  c[key] = { texte, etat, majAt: new Date().toISOString(), par };
  const total = BRIEF_SECTIONS.length, valides = BRIEF_SECTIONS.filter((s) => sectionDe(c, s.key).etat === "VALIDE").length, recues = BRIEF_SECTIONS.filter((s) => sectionDe(c, s.key).etat !== "ATTENDU").length;
  const etatBrief = b.etat === "VALIDE" ? "VALIDE" : valides === total ? "COMPLET" : recues < total ? "ATTENDU_CLIENT" : "EN_COURS";
  await prisma.brief.update({ where: { siteId }, data: { contenu: c, etat: etatBrief } });
  return c[key];
}
