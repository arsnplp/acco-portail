/** Modèle de description des invitations Google Agenda (Paramètres → Agence), variables : {{societe}} {{prenom}} {{commercial}} {{lieu}}. */
import { prisma } from "@/lib/prisma";
import { remplacerVariables, type Variables } from "@/lib/gmail-send";

export const RDV_MODELE_DEFAUT = `Bonjour {{prenom}},

Voici notre rendez-vous pour {{societe}} avec ACCO LAB.
Nous ferons le point sur votre activité, votre présence en ligne et ce que nous pouvons mettre en place ensemble.

{{lieu}}

À très vite,
{{commercial}} – ACCO LAB
acco-lab.fr`;

export async function modeleRdv() {
  return (await prisma.setting.findUnique({ where: { key: "rdv_description_modele" } }))?.value || RDV_MODELE_DEFAUT;
}
export async function descriptionRdv(vars: Variables) {
  return remplacerVariables(await modeleRdv(), vars).replace(/\n{3,}/g, "\n\n").trim();
}
