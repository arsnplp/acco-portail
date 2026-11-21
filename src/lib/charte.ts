/**
 * Charte graphique (DA) d'un site, rédigée par l'équipe à la livraison, lue par le client dans « Votre DA » (deux volets :
 * identité visuelle, esprit de marque et conseils). Contenu JSON sur la table Charte ; fichiers (logo, polices) sur ChartePiece.
 */
import { prisma } from "@/lib/prisma";

export type Couleur = { nom: string; hex: string; usage: string };
export type Puce = { titre: string; texte: string };
export type Charte = {
  // 01 identité visuelle
  couleurs: Couleur[]; // ex. Vert végétal #586B50 « boutons, titres »
  policeTitres: string; policeTextes: string; policesNote: string;
  photoTexte: string; // univers photographique : phrase d'intention
  photoPuces: Puce[]; // ex. Compositions florales : textures douces et couleurs naturelles
  densite: string; formes: string; mode: string; // style (facultatif)
  // 03 esprit de marque
  espritTexte: string; // une marque chaleureuse, artisanale…
  adjectifs: string[]; // Authentique, Chaleureuse…
  ressenti: string; // ce que les clients doivent ressentir
  // 04 façon de communiquer
  ton: string; privilegier: string; eviter: string;
  // 05 conseils Acco
  conseils: Puce[];
  note: string; // bon à savoir (règles d'usage du logo…)
};

export const CHARTE_VIDE: Charte = { couleurs: [], policeTitres: "", policeTextes: "", policesNote: "", photoTexte: "", photoPuces: [], densite: "", formes: "", mode: "", espritTexte: "", adjectifs: [], ressenti: "", ton: "", privilegier: "", eviter: "", conseils: [], note: "" };

export const DENSITES: { key: string; label: string; aide: string }[] = [
  { key: "aere", label: "Aéré", aide: "beaucoup d’espace, on respire" }, { key: "equilibre", label: "Équilibré", aide: "ni trop, ni trop peu" }, { key: "dense", label: "Dense", aide: "beaucoup d’infos visibles d’un coup" },
];
export const FORMES: { key: string; label: string; aide: string }[] = [{ key: "arrondi", label: "Arrondies", aide: "angles doux" }, { key: "droit", label: "Droites", aide: "angles nets" }];
export const MODES: { key: string; label: string; aide: string }[] = [{ key: "clair", label: "Clair", aide: "fond clair, texte foncé" }, { key: "sombre", label: "Sombre", aide: "fond foncé, texte clair" }, { key: "les-deux", label: "Les deux", aide: "selon le réglage du visiteur" }];
export const PIECE_KINDS: Record<string, string> = { logo: "Logo", police: "Police", autre: "Autre" };

export const lab = (liste: { key: string; label: string }[], key: string) => liste.find((x) => x.key === key)?.label ?? "";
const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexOk = (v: string) => HEX.test(v);

const str = (o: Record<string, unknown>, k: string, max = 2000) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : "");
const puces = (v: unknown, max = 12): Puce[] => (Array.isArray(v) ? v : []).map((p) => (p && typeof p === "object" ? { titre: str(p as Record<string, unknown>, "titre", 120), texte: str(p as Record<string, unknown>, "texte", 600) } : null)).filter((p): p is Puce => !!p && !!(p.titre || p.texte)).slice(0, max);

/** Lecture tolérante du JSON stocké (les anciennes chartes à 5 couleurs fixes sont converties). */
export function lireCharte(raw: unknown): Charte {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let couleurs: Couleur[] = (Array.isArray(o.couleurs) ? o.couleurs : []).map((c) => (c && typeof c === "object" ? { nom: str(c as Record<string, unknown>, "nom", 60), hex: str(c as Record<string, unknown>, "hex", 7).toLowerCase(), usage: str(c as Record<string, unknown>, "usage", 120) } : null)).filter((c): c is Couleur => !!c && HEX.test(c.hex)).slice(0, 8);
  if (!couleurs.length && o.couleurs && typeof o.couleurs === "object" && !Array.isArray(o.couleurs)) {
    const anc = o.couleurs as Record<string, unknown>;
    const noms: Record<string, string> = { principale: "Principale", secondaire: "Secondaire", accent: "Accent", fond: "Fond", texte: "Texte" };
    couleurs = Object.entries(noms).filter(([k]) => typeof anc[k] === "string" && HEX.test(anc[k] as string)).map(([k, n]) => ({ nom: n, hex: (anc[k] as string).toLowerCase(), usage: "" }));
  }
  return {
    couleurs, policeTitres: str(o, "policeTitres", 120), policeTextes: str(o, "policeTextes", 120), policesNote: str(o, "policesNote", 600),
    photoTexte: str(o, "photoTexte", 600), photoPuces: puces(o.photoPuces), densite: str(o, "densite", 20), formes: str(o, "formes", 20), mode: str(o, "mode", 20),
    espritTexte: str(o, "espritTexte", 800) || str(o, "ambiance", 800), adjectifs: (Array.isArray(o.adjectifs) ? o.adjectifs : []).filter((a): a is string => typeof a === "string" && !!a.trim()).map((a) => a.trim().slice(0, 30)).slice(0, 10), ressenti: str(o, "ressenti", 400),
    ton: str(o, "ton", 600), privilegier: str(o, "privilegier", 400), eviter: str(o, "eviter", 400),
    conseils: puces(o.conseils), note: str(o, "note", 3000),
  };
}

/** Nettoyage avant enregistrement : valeurs connues uniquement. */
export function nettoyerCharte(raw: unknown): Charte {
  const c = lireCharte(raw);
  const dans = (liste: { key: string }[], v: string) => (liste.some((x) => x.key === v) ? v : "");
  return { ...c, densite: dans(DENSITES, c.densite), formes: dans(FORMES, c.formes), mode: dans(MODES, c.mode) };
}

export const charteRenseignee = (c: Charte) => !!(c.couleurs.length || c.policeTitres || c.policeTextes || c.espritTexte || c.conseils.length);

export async function chargerCharte(siteId: string) {
  return prisma.charte.upsert({ where: { siteId }, create: { siteId }, update: {}, include: { pieces: { orderBy: { createdAt: "asc" } } } });
}
