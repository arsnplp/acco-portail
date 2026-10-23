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
// Notification push à l'équipe, comme pour une vraie demande client.
const portail = (process.env.PORTAIL_URL || "https://app.acco-lab.fr").replace(/\/$/, "");
if (process.env.CRON_SECRET) {
  const res = await fetch(`${portail}/api/claude/demande-recue`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ id: cr.id }) }).catch(() => null);
  console.log(res?.ok ? "🔔 Notification envoyée à l'équipe" : `⚠ Notification non envoyée (${res ? res.status : "portail injoignable"}) — portail à jour ?`);
} else console.log("⚠ CRON_SECRET absent du .env : pas de notification");
console.log("→ app.acco-lab.fr/admin/modifications");
await prisma.$disconnect();
