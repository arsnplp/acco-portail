/**
 * Charte graphique (DA) d'un site : récapitulatif rédigé par l'équipe à la livraison de ce qui a été utilisé
 * (ambiance, couleurs, polices, espacements, formes, mode, images), plus les fichiers (logo dans ses versions, polices).
 * Le client la consulte en lecture seule dans l'onglet « Votre DA » de son site une fois publiée.
 */
import { prisma } from "@/lib/prisma";

export type Charte = {
  ambiance: string; // en quelques mots : chaleureux et artisanal, épuré et moderne…
  couleurs: { principale: string; secondaire: string; accent: string; fond: string; texte: string }; // hex ou vide
  couleursNote: string; // usage de chaque couleur, codes complémentaires
  policeTitres: string; // nom de la police des titres
  policeTextes: string; // nom de la police des textes
  policesNote: string; // graisses, tailles, où la trouver (Google Fonts…)
  densite: string; // aere | equilibre | dense
  formes: string; // arrondi | droit
  mode: string; // clair | sombre | les-deux
  images: string; // photos | illustrations | minimal
  note: string; // tout ce qui est utile au client : règles d'usage du logo, marges, icônes…
};

export const CHARTE_VIDE: Charte = { ambiance: "", couleurs: { principale: "", secondaire: "", accent: "", fond: "", texte: "" }, couleursNote: "", policeTitres: "", policeTextes: "", policesNote: "", densite: "", formes: "", mode: "", images: "", note: "" };

export const COULEURS: { key: keyof Charte["couleurs"]; label: string; aide: string }[] = [
  { key: "principale", label: "Principale", aide: "boutons, titres, ce qu’on voit en premier" },
  { key: "secondaire", label: "Secondaire", aide: "fonds de sections, encadrés" },
  { key: "accent", label: "Accent", aide: "petites touches, icônes, liens" },
  { key: "fond", label: "Fond", aide: "fond général des pages" },
  { key: "texte", label: "Texte", aide: "couleur du texte courant" },
];
export const DENSITES: { key: string; label: string; aide: string }[] = [
  { key: "aere", label: "Aéré", aide: "beaucoup d’espace, on respire" },
  { key: "equilibre", label: "Équilibré", aide: "ni trop, ni trop peu" },
  { key: "dense", label: "Dense", aide: "beaucoup d’infos visibles d’un coup" },
];
export const FORMES: { key: string; label: string; aide: string }[] = [
  { key: "arrondi", label: "Arrondies", aide: "angles doux" },
  { key: "droit", label: "Droites", aide: "angles nets" },
];
export const MODES: { key: string; label: string; aide: string }[] = [
  { key: "clair", label: "Clair", aide: "fond clair, texte foncé" },
  { key: "sombre", label: "Sombre", aide: "fond foncé, texte clair" },
  { key: "les-deux", label: "Les deux", aide: "selon le réglage du visiteur" },
];
export const IMAGES: { key: string; label: string; aide: string }[] = [
  { key: "photos", label: "Vraies photos", aide: "équipe, local, réalisations" },
  { key: "illustrations", label: "Illustrations", aide: "dessins, pictos" },
  { key: "minimal", label: "Peu d’images", aide: "le texte avant tout" },
];
export const PIECE_KINDS: Record<string, string> = { logo: "Logo", police: "Police", autre: "Autre" };

export const lab = (liste: { key: string; label: string }[], key: string) => liste.find((x) => x.key === key)?.label ?? "";
const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexOk = (v: string) => HEX.test(v);

/** Lecture tolérante du JSON stocké. */
export function lireCharte(raw: unknown): Charte {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const c = (o.couleurs && typeof o.couleurs === "object" ? o.couleurs : {}) as Record<string, unknown>;
  const hex = (k: string) => (typeof c[k] === "string" && HEX.test(c[k] as string) ? (c[k] as string).toLowerCase() : "");
  return {
    ambiance: str("ambiance"), couleurs: { principale: hex("principale"), secondaire: hex("secondaire"), accent: hex("accent"), fond: hex("fond"), texte: hex("texte") }, couleursNote: str("couleursNote"),
    policeTitres: str("policeTitres"), policeTextes: str("policeTextes"), policesNote: str("policesNote"),
    densite: str("densite"), formes: str("formes"), mode: str("mode"), images: str("images"), note: str("note"),
  };
}

/** Nettoyage avant enregistrement : valeurs connues, textes bornés. */
export function nettoyerCharte(raw: unknown): Charte {
  const c = lireCharte(raw);
  const dans = (liste: { key: string }[], v: string) => (liste.some((x) => x.key === v) ? v : "");
  const txt = (v: string, max: number) => v.trim().slice(0, max);
  return {
    ambiance: txt(c.ambiance, 600), couleurs: c.couleurs, couleursNote: txt(c.couleursNote, 1000),
    policeTitres: txt(c.policeTitres, 120), policeTextes: txt(c.policeTextes, 120), policesNote: txt(c.policesNote, 600),
    densite: dans(DENSITES, c.densite), formes: dans(FORMES, c.formes), mode: dans(MODES, c.mode), images: dans(IMAGES, c.images), note: txt(c.note, 3000),
  };
}

/** Une charte est « renseignée » dès qu'elle a une couleur principale ou une police ou une ambiance. */
export const charteRenseignee = (c: Charte) => !!(c.couleurs.principale || c.policeTitres || c.policeTextes || c.ambiance);

export async function chargerCharte(siteId: string) {
  return prisma.charte.upsert({ where: { siteId }, create: { siteId }, update: {}, include: { pieces: { orderBy: { createdAt: "asc" } } } });
}
