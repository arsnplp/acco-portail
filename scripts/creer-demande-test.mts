/**
 * Crée (une seule fois) le client interne « Acco », son site acco-lab.fr relié à GitHub,
 * et une demande de modification de test (Paris → Aix-en-Provence) dans « Reçue ».
 *   npx tsx --env-file=.env scripts/creer-demande-test.mts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TITLE = "Remplacer Paris par Aix-en-Provence (SEO)";
const DESCRIPTION = `Partout sur le site, remplacer « Paris » par « Aix-en-Provence » pour le référencement local : textes visibles, balises <title>, meta description, Open Graph, données structurées JSON-LD, sitemap, alt des images, sous-titres « Agence Web Paris » → « Agence Web Aix-en-Provence ».

NE PAS modifier les informations légales : l'adresse du siège « 47 rue Vivienne, 75002 Paris » et « R.C.S. Paris » dans les mentions légales (et ailleurs s'ils apparaissent) doivent rester telles quelles.

Adapter la grammaire si besoin (« à Paris » → « à Aix-en-Provence », « parisien » → « aixois »).`;

const client =
  (await prisma.client.findFirst({ where: { name: "Acco (interne)" } })) ??
  (await prisma.client.create({ data: { name: "Acco (interne)", email: "arsene@acco-lab.fr" } }));

let site = await prisma.site.findFirst({ where: { clientId: client.id, name: "acco-lab.fr" } });
site = site
  ? await prisma.site.update({ where: { id: site.id }, data: { repoUrl: "https://github.com/arsnplp/Acco.git" } })
  : await prisma.site.create({
      data: { clientId: client.id, name: "acco-lab.fr", url: "https://acco-lab.fr", status: "EN_LIGNE", projectStep: "MISE_EN_LIGNE", repoUrl: "https://github.com/arsnplp/Acco.git" },
    });

const existing = await prisma.changeRequest.findFirst({ where: { siteId: site.id, title: TITLE, status: { not: "TERMINEE" } } });
const cr = existing ?? (await prisma.changeRequest.create({ data: { siteId: site.id, title: TITLE, description: DESCRIPTION, page: "Tout le site" } }));

console.log(`✓ Client : ${client.name}`);
console.log(`✓ Site   : ${site.name} → ${site.repoUrl}`);
console.log(`✓ Demande ${existing ? "déjà présente" : "créée"} : « ${cr.title} » (${cr.status})`);
console.log("→ Ouvre app.acco-lab.fr/admin/modifications");
await prisma.$disconnect();
