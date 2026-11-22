/**
 * Articles 1 à 3 du contrat (prestations, création, conditions financières), construits à partir des choix de l'assistant.
 * Sans dépendance serveur : utilisé par l'aperçu (étape 4) et par le PDF. Les articles suivants viennent du modèle (Paramètres → Contrats).
 */
export type FormuleKey = "ESSENTIEL" | "REFERENCE" | "CONQUETE" | "SIGNATURE";
export const FORMULES_DETAIL: Record<FormuleKey, { label: string; sousTitre: string; inclus: string[]; mensuel: number; frais: number }> = {
  ESSENTIEL: { label: "Essentiel", sousTitre: "Site vitrine essentiel", inclus: ["Site vitrine jusqu'à 5 pages", "Hébergement, nom de domaine et sécurité", "Modifications courantes incluses"], mensuel: 14990, frais: 30000 },
  REFERENCE: { label: "Référence", sousTitre: "Site multipage", inclus: ["Site multipage", "Référencement local (SEO)", "Hébergement, nom de domaine et sécurité", "Modifications courantes incluses"], mensuel: 22990, frais: 30000 },
  CONQUETE: { label: "Conquête", sousTitre: "Site + référencement + acquisition", inclus: ["Jusqu'à 30 pages", "SEO / GEO", "Audits", "Modifications courantes illimitées"], mensuel: 26990, frais: 30000 },
  SIGNATURE: { label: "Signature", sousTitre: "Sur mesure", inclus: ["Site sur mesure", "Accompagnement complet", "SEO / GEO et audits", "Modifications illimitées"], mensuel: 49990, frais: 30000 },
};
export const INCLUS_AUTOMATIQUE = "1 heure de conseil marketing par trimestre, à la demande du client, non cumulable, en présentiel selon disponibilité et localisation ou en visioconférence.";
export const DUREES: { mois: number; label: string }[] = [{ mois: 24, label: "24 mois" }, { mois: 36, label: "36 mois" }, { mois: 12, label: "12 mois" }, { mois: 0, label: "Sans engagement" }];
export const MOYENS_PAIEMENT: [string, string][] = [["SEPA", "Prélèvement SEPA"], ["CARTE", "Carte bancaire (lien Stripe)"], ["VIREMENT", "Virement"], ["LIEN", "Lien de paiement"], ["AUTRE", "Autre"]];

export type ChoixContrat = {
  formule: FormuleKey | null; titre: string;
  dureeMois: number; frais: number; mensuel: number; moisOffert: boolean; // centimes
  options: { libelle: string; detail: string; montantHt: number; billing: "MENSUEL" | "PONCTUEL" }[];
  moyenPaiement: string; jourPrelevement: number; dateSignature: string; // YYYY-MM-DD
};

export const eurosHt = (c: number) => `${(c / 100).toLocaleString("fr-FR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} € HT`;
const fmtMois = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); };
const fmt = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); };
const plusMois = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

/** Articles 1 à 3, prêts à afficher ou à imprimer : [titre, corps]. */
export function articlesContrat(c: ChoixContrat): [string, string][] {
  const f = c.formule ? FORMULES_DETAIL[c.formule] : null;
  const l1: string[] = [];
  if (f) l1.push(`Formule ${f.label} : ${f.inclus.join(", ")}.`);
  for (const o of c.options) l1.push(`${o.libelle}${o.detail ? ` : ${o.detail.replace(/[.\s]+$/, "")}` : ""}${o.billing === "PONCTUEL" ? " (prestation ponctuelle)" : ""}.`);
  l1.push(`Conseil marketing : ${INCLUS_AUTOMATIQUE}`);
  const a1 = l1.map((t) => `• ${t}`).join("\n");

  const a2 = `Première maquette présentée sous 14 jours ouvrés à réception des éléments du Client (textes, images, logo, accès). La maquette est validée par document signé ou acceptation en ligne. Sans réponse du Client, des relances sont effectuées et tracées ; au-delà de 30 jours sans retour, la maquette est réputée acceptée. Deux séries de corrections sont incluses avant la mise en ligne.`;

  const debutPayant = c.moisOffert ? plusMois(c.dateSignature, 1) : c.dateSignature;
  const l3: string[] = [];
  if (c.frais) l3.push(`Frais de lancement : ${eurosHt(c.frais)}, dus à la signature.`);
  l3.push(`Mensualité : ${eurosHt(c.mensuel)}${c.options.some((o) => o.billing === "MENSUEL") ? ` (dont options : ${eurosHt(c.options.filter((o) => o.billing === "MENSUEL").reduce((a, o) => a + o.montantHt, 0))})` : ""}.`);
  const ponct = c.options.filter((o) => o.billing === "PONCTUEL").reduce((a, o) => a + o.montantHt, 0);
  if (ponct) l3.push(`Prestations ponctuelles : ${eurosHt(ponct)}, facturées à la réalisation.`);
  l3.push(c.dureeMois ? `Engagement de ${c.dureeMois} mois à compter du ${fmt(debutPayant)}, reconduit tacitement par périodes de ${c.dureeMois} mois sauf résiliation dans les conditions prévues ci-après.` : `Sans engagement de durée : chaque partie peut mettre fin au contrat à tout moment avec un préavis d'un mois.`);
  if (c.moisOffert) l3.push(`Mois de signature offert : le mois de ${fmtMois(c.dateSignature)} n'est pas facturé ; l'engagement payant commence le ${fmt(debutPayant)}.`);
  l3.push(`Paiement : ${MOYENS_PAIEMENT.find(([k]) => k === c.moyenPaiement)?.[1] ?? "à convenir"}${c.moyenPaiement === "SEPA" ? `, échéance le ${c.jourPrelevement} de chaque mois` : ""}. TVA en sus au taux en vigueur.`);
  return [["Article 1 – Prestations", a1], ["Article 2 – Création", a2], ["Article 3 – Conditions financières", l3.join("\n")]];
}
