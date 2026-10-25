/**
 * Nettoie les fiches existantes : téléphones au format « 06 12 34 56 78 », prénoms et noms des contacts en « Prénom Nom ».
 * Ne touche qu'à l'espace Commercial. Aucun mail ni notification.
 *
 *   npx tsx --env-file=.env scripts/normaliser-crm.mts              # aperçu
 *   npx tsx --env-file=.env scripts/normaliser-crm.mts --confirmer  # applique
 */
import { PrismaClient } from "@prisma/client";
import { formatTel, nettoyerNom } from "../src/lib/crm.js";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirmer");
let n = 0;
const exemples: string[] = [];

for (const p of await prisma.prospect.findMany({ select: { id: true, telephone: true } })) {
  const t = formatTel(p.telephone);
  if (t !== p.telephone) { n++; if (exemples.length < 8) exemples.push(`${p.telephone} → ${t}`); if (confirm) await prisma.prospect.update({ where: { id: p.id }, data: { telephone: t } }); }
}
for (const c of await prisma.prospectContact.findMany({ select: { id: true, prenom: true, nom: true, telephone: true } })) {
  const data = { prenom: nettoyerNom(c.prenom), nom: nettoyerNom(c.nom), telephone: formatTel(c.telephone) };
  if (data.prenom !== c.prenom || data.nom !== c.nom || data.telephone !== c.telephone) {
    n++; if (exemples.length < 16) exemples.push(`${c.prenom ?? ""} ${c.nom ?? ""} ${c.telephone ?? ""} → ${data.prenom ?? ""} ${data.nom ?? ""} ${data.telephone ?? ""}`);
    if (confirm) await prisma.prospectContact.update({ where: { id: c.id }, data });
  }
}
console.log(`${n} ligne(s) ${confirm ? "nettoyée(s)" : "à nettoyer"}. Exemples :`);
for (const e of exemples) console.log(`  • ${e}`);
if (!confirm) console.log("\nAperçu seulement. Pour appliquer : ajouter --confirmer");
await prisma.$disconnect();
