/**
 * Charte graphique du client (« Votre DA » dans le portail, onglet « Charte » de la fiche client côté équipe).
 * Tout est facultatif : le client coche des ambiances, choisit ses couleurs, un style de police, la densité, les formes,
 * dépose son logo et ses inspirations. L'aperçu se met à jour en direct pour qu'il voie ce que ça donne.
 */
import { prisma } from "@/lib/prisma";

export type Charte = {
  ambiance: string[]; // 3 maximum
  mots: string; // trois mots qui décrivent la marque
  couleurs: { principale: string; secondaire: string; accent: string }; // hex ou vide
  couleursNote: string; // couleurs existantes / à éviter
  policeTitres: string; // clé de POLICES ou vide
  policeTextes: string;
  policesNote: string; // polices déjà utilisées (enseigne, cartes de visite…)
  densite: string; // aere | equilibre | dense
  formes: string; // arrondi | droit
  mode: string; // clair | sombre | les-deux
  images: string; // photos | illustrations | minimal
  logoEtat: string; // ai | a-refaire | a-creer
  inspirations: string; // liens, un par ligne
  eviter: string; // ce qu'il ne faut surtout pas faire
};

export const CHARTE_VIDE: Charte = { ambiance: [], mots: "", couleurs: { principale: "", secondaire: "", accent: "" }, couleursNote: "", policeTitres: "", policeTextes: "", policesNote: "", densite: "", formes: "", mode: "", images: "", logoEtat: "", inspirations: "", eviter: "" };

export const AMBIANCES: { key: string; label: string; aide: string }[] = [
  { key: "chaleureux", label: "Chaleureux", aide: "accueillant, proche des gens" },
  { key: "epure", label: "Épuré", aide: "peu d’éléments, beaucoup d’air" },
  { key: "design", label: "Design", aide: "soigné, tendance" },
  { key: "sobre", label: "Sobre", aide: "discret, sérieux" },
  { key: "colore", label: "Coloré", aide: "vif, joyeux" },
  { key: "elegant", label: "Élégant", aide: "raffiné, haut de gamme" },
  { key: "naturel", label: "Naturel", aide: "matières, tons terre" },
  { key: "moderne", label: "Moderne", aide: "net, actuel" },
  { key: "fun", label: "Fun", aide: "décalé, ludique" },
  { key: "traditionnel", label: "Traditionnel", aide: "savoir-faire, classique" },
];
export const MAX_AMBIANCES = 3;

/** Styles de police, avec la famille utilisée dans l'aperçu (polices système : rien à charger). */
export const POLICES: { key: string; label: string; aide: string; famille: string }[] = [
  { key: "sans", label: "Moderne", aide: "lettres simples, sans empattement", famille: "Inter, system-ui, Helvetica, Arial, sans-serif" },
  { key: "serif", label: "Classique", aide: "avec empattement, comme un journal", famille: "Georgia, 'Times New Roman', serif" },
  { key: "arrondie", label: "Arrondie", aide: "douce, sympathique", famille: "'Arial Rounded MT Bold', 'Nunito', 'Varela Round', system-ui, sans-serif" },
  { key: "manuscrite", label: "Manuscrite", aide: "comme écrit à la main", famille: "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive" },
  { key: "libre", label: "À vous de voir", aide: "je vous fais confiance", famille: "Inter, system-ui, sans-serif" },
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
  { key: "clair", label: "Clair", aide: "fond blanc, texte foncé" },
  { key: "sombre", label: "Sombre", aide: "fond foncé, texte clair" },
  { key: "les-deux", label: "Les deux", aide: "selon le réglage du visiteur" },
];
export const IMAGES: { key: string; label: string; aide: string }[] = [
  { key: "photos", label: "Vraies photos", aide: "votre équipe, votre local, vos réalisations" },
  { key: "illustrations", label: "Illustrations", aide: "dessins, pictos" },
  { key: "minimal", label: "Peu d’images", aide: "le texte avant tout" },
];
export const LOGO_ETATS: { key: string; label: string; aide: string }[] = [
  { key: "ai", label: "J’ai un logo", aide: "déposez-le ci-dessous" },
  { key: "a-refaire", label: "J’en ai un, à moderniser", aide: "déposez l’actuel" },
  { key: "a-creer", label: "Pas de logo", aide: "à créer avec vous" },
];
export const PIECE_KINDS: Record<string, string> = { logo: "Logo", police: "Police", inspiration: "Inspiration", autre: "Autre" };

export const lab = (liste: { key: string; label: string }[], key: string) => liste.find((x) => x.key === key)?.label ?? "";
export const familleDe = (key: string) => POLICES.find((p) => p.key === key)?.famille ?? POLICES[0].famille;
const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexOk = (v: string) => HEX.test(v);

/** Lecture tolérante du JSON stocké. */
export function lireCharte(raw: unknown): Charte {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const c = (o.couleurs && typeof o.couleurs === "object" ? o.couleurs : {}) as Record<string, unknown>;
  const hex = (k: string) => (typeof c[k] === "string" && HEX.test(c[k] as string) ? (c[k] as string) : "");
  return {
    ambiance: Array.isArray(o.ambiance) ? (o.ambiance as unknown[]).filter((x): x is string => typeof x === "string" && AMBIANCES.some((a) => a.key === x)).slice(0, MAX_AMBIANCES) : [],
    mots: str("mots"), couleurs: { principale: hex("principale"), secondaire: hex("secondaire"), accent: hex("accent") }, couleursNote: str("couleursNote"),
    policeTitres: str("policeTitres"), policeTextes: str("policeTextes"), policesNote: str("policesNote"),
    densite: str("densite"), formes: str("formes"), mode: str("mode"), images: str("images"), logoEtat: str("logoEtat"), inspirations: str("inspirations"), eviter: str("eviter"),
  };
}

/** Nettoyage avant enregistrement : uniquement des valeurs connues, textes bornés. */
export function nettoyerCharte(raw: unknown): Charte {
  const c = lireCharte(raw);
  const dans = (liste: { key: string }[], v: string) => (liste.some((x) => x.key === v) ? v : "");
  const txt = (v: string, max: number) => v.trim().slice(0, max);
  return {
    ambiance: c.ambiance, mots: txt(c.mots, 120), couleurs: c.couleurs, couleursNote: txt(c.couleursNote, 500),
    policeTitres: dans(POLICES, c.policeTitres), policeTextes: dans(POLICES, c.policeTextes), policesNote: txt(c.policesNote, 300),
    densite: dans(DENSITES, c.densite), formes: dans(FORMES, c.formes), mode: dans(MODES, c.mode), images: dans(IMAGES, c.images), logoEtat: dans(LOGO_ETATS, c.logoEtat),
    inspirations: txt(c.inspirations, 1500), eviter: txt(c.eviter, 1000),
  };
}

/** Avancement : parties renseignées sur les 8 (ambiance, couleurs, polices, espacements, formes, mode, images, logo). */
export function avancementCharte(c: Charte, aLogo: boolean) {
  const parties: { label: string; ok: boolean }[] = [
    { label: "Ambiance", ok: c.ambiance.length > 0 },
    { label: "Couleurs", ok: !!c.couleurs.principale },
    { label: "Polices", ok: !!c.policeTitres || !!c.policeTextes },
    { label: "Espacements", ok: !!c.densite },
    { label: "Formes", ok: !!c.formes },
    { label: "Clair / sombre", ok: !!c.mode },
    { label: "Images", ok: !!c.images },
    { label: "Logo", ok: aLogo || c.logoEtat === "a-creer" },
  ];
  const faites = parties.filter((p) => p.ok).length;
  return { parties, faites, total: parties.length, pourcent: Math.round((faites / parties.length) * 100) };
}

export async function chargerCharte(clientId: string) {
  return prisma.charte.upsert({ where: { clientId }, create: { clientId }, update: {}, include: { pieces: { orderBy: { createdAt: "asc" } } } });
}

/** Résumé texte pour l'équipe (fiche client, brief, IA). */
export function resumeCharte(c: Charte) {
  const l: string[] = [];
  if (c.ambiance.length) l.push(`Ambiance : ${c.ambiance.map((k) => lab(AMBIANCES, k)).join(", ")}`);
  if (c.mots) l.push(`Mots : ${c.mots}`);
  const cols = [c.couleurs.principale && `principale ${c.couleurs.principale}`, c.couleurs.secondaire && `secondaire ${c.couleurs.secondaire}`, c.couleurs.accent && `accent ${c.couleurs.accent}`].filter(Boolean);
  if (cols.length) l.push(`Couleurs : ${cols.join(", ")}`);
  if (c.policeTitres || c.policeTextes) l.push(`Polices : titres ${lab(POLICES, c.policeTitres) || "—"}, textes ${lab(POLICES, c.policeTextes) || "—"}`);
  if (c.densite) l.push(`Espacements : ${lab(DENSITES, c.densite)}`);
  if (c.formes) l.push(`Formes : ${lab(FORMES, c.formes)}`);
  if (c.mode) l.push(`Mode : ${lab(MODES, c.mode)}`);
  if (c.images) l.push(`Images : ${lab(IMAGES, c.images)}`);
  if (c.logoEtat) l.push(`Logo : ${lab(LOGO_ETATS, c.logoEtat)}`);
  return l;
}
