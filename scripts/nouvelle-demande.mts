/**
 * Crée une demande de modification « Reçue » sur un site du portail, comme si le client l'avait envoyée.
 *   npx tsx --env-file=.env scripts/nouvelle-demande.mts --site acco-lab.fr --titre "…" --description "…" [--page "…"] [--urgent]
 */
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";

const { values: a } = parseArgs({ options: { site: { type: "string" }, titre: { type: "string" }, description: { type: "string" }, page: { type: "string" }, urgent: { type: "boolean" } } });
if (!a.site || !a.titre || !a.description) {
  console.error('Usage : --site acco-lab.fr --titre "…" --description "…" [--page "…"] [--urgent]');
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findFirst({ where: { name: a.site }, include: { client: true } });
if (!site) {
  console.error(`Site « ${a.site} » introuvable. Sites : ${(await prisma.site.findMany({ select: { name: true } })).map((s) => s.name).join(", ")}`);
  process.exit(1);
}
const cr = await prisma.changeRequest.create({
  data: { siteId: site.id, title: a.titre, description: a.description, page: a.page || null, urgency: a.urgent ? "URGENTE" : "NORMALE" },
});
console.log(`✓ Demande créée sur ${site.name} (${site.client.name}) : « ${cr.title} »`);
console.log("→ app.acco-lab.fr/admin/modifications");
await prisma.$disconnect();
