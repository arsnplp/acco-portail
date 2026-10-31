/**
 * Crée une demande de modification « Reçue » sur un site du portail, comme si le client l'avait envoyée.
 *   npx tsx --env-file=.env scripts/nouvelle-demande.mts --site acco-lab.fr --titre "…" --description "…" [--page "…"] [--urgent]
 * Si le site n'existe pas encore dans le portail, il est créé (avec son client) quand --client et --repo sont fournis :
 *   … --client "Acco" --repo https://github.com/arsnplp/Acco.git [--url https://acco-lab.fr] [--branche main] [--dossier site]
 */
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";

const { values: a } = parseArgs({ options: {
  site: { type: "string" }, titre: { type: "string" }, description: { type: "string" }, page: { type: "string" }, urgent: { type: "boolean" },
  client: { type: "string" }, repo: { type: "string" }, url: { type: "string" }, branche: { type: "string" }, dossier: { type: "string" },
} });
if (!a.site || !a.titre || !a.description) {
  console.error('Usage : --site acco-lab.fr --titre "…" --description "…" [--page "…"] [--urgent]');
  process.exit(1);
}

const prisma = new PrismaClient();
let site = await prisma.site.findFirst({ where: { name: a.site }, include: { client: true } });
if (!site && a.client && a.repo) {
  const client = (await prisma.client.findFirst({ where: { name: a.client } })) ?? (await prisma.client.create({ data: { name: a.client } }));
  site = await prisma.site.create({
    data: {
      clientId: client.id, name: a.site, url: a.url ?? `https://${a.site}`, status: "EN_LIGNE", projectStep: "A_LIVRER", launchedAt: new Date(),
      repoUrl: a.repo, repoBranch: a.branche || null, repoRoot: a.dossier || null,
    },
    include: { client: true },
  });
  console.log(`✓ Site créé : ${site.name} (client ${client.name}) relié à ${a.repo}`);
}
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
