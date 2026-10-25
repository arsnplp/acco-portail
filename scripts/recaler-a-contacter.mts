/**
 * Remet les fiches dans la bonne colonne selon la règle :
 *   « À contacter » = jamais eu au téléphone (aucun échange, ou seulement des NRP).
 * - À contacter avec un vrai échange (appel, mail, PP, RDV…)  → À relancer
 * - À relancer sans aucun vrai échange (rien ou que des NRP)   → À contacter
 * Les autres colonnes ne bougent pas. Aucun mail ni notification.
 *
 *   npx tsx --env-file=.env scripts/recaler-a-contacter.mts              # aperçu
 *   npx tsx --env-file=.env scripts/recaler-a-contacter.mts --confirmer  # applique
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirmer");
const vrai = { type: { notIn: ["NRP", "NOTE"] as ("NRP" | "NOTE")[] } };

const versRelancer = await prisma.prospect.findMany({ where: { statut: "A_CONTACTER", echanges: { some: vrai } }, select: { id: true, societe: true } });
const versContacter = await prisma.prospect.findMany({ where: { statut: "A_RELANCER", echanges: { none: vrai } }, select: { id: true, societe: true } });

console.log(`${versRelancer.length} fiche(s) « À contacter » déjà eues au téléphone → À relancer`);
for (const p of versRelancer) console.log(`  • ${p.societe}`);
console.log(`${versContacter.length} fiche(s) « À relancer » jamais eues (que des NRP) → À contacter`);
for (const p of versContacter) console.log(`  • ${p.societe}`);

if (confirm) {
  await prisma.$transaction([
    prisma.prospect.updateMany({ where: { id: { in: versRelancer.map((p) => p.id) } }, data: { statut: "A_RELANCER" } }),
    prisma.prospect.updateMany({ where: { id: { in: versContacter.map((p) => p.id) } }, data: { statut: "A_CONTACTER" } }),
  ]);
  console.log("\n✓ Fiches déplacées.");
} else console.log("\nAperçu seulement. Pour appliquer : ajouter --confirmer");
await prisma.$disconnect();
