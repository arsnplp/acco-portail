/**
 * Retire toutes les données de test pour que l'app soit prête à l'emploi. Ne touche ni aux vrais clients,
 * ni aux vrais prospects importés, ni aux offres, réglages et comptes de l'équipe.
 *
 *   npx tsx --env-file=.env scripts/nettoyer-donnees-test.mts              # aperçu, ne supprime rien
 *   npx tsx --env-file=.env scripts/nettoyer-donnees-test.mts --confirmer  # supprime pour de bon
 *   ... --confirmer --avec-fiches-manuelles   # retire aussi les fiches créées à la main pendant les essais
 *
 * Ce qui part :
 *  1. CRM : les prospects et projets de test (fiches « (test) », avec leurs contacts, échanges, RDV)
 *     et les cibles qui ne servent plus à aucune fiche ;
 *  2. le compte de connexion « Client test » (test.client@acco-lab.fr) ;
 *  3. les clients et comptes de démonstration du tout début (Boulangerie Dupont, Benali Plomberie, demo.*@acco-lab.fr) ;
 *  4. les avis Google d'exemple (mode démo) ;
 *  5. les chiffres Search Console de démo des sites non reliés à Google, et leurs récaps jamais envoyés.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const confirm = process.argv.includes("--confirmer");
const manuelles = process.argv.includes("--avec-fiches-manuelles");
const prisma = new PrismaClient();

const TEST_ACCOUNTS = ["test.client@acco-lab.fr"];
const DEMO_CLIENTS = ["Boulangerie Dupont", "Benali Plomberie"];

const [prospects, projets, testUsers, demoUsers, demoClients, demoReviews, demoSites] = await Promise.all([
  prisma.prospect.count({ where: { legacyId: { startsWith: "test-" } } }),
  prisma.projet.count({ where: { legacyId: { startsWith: "test-" } } }),
  prisma.user.findMany({ where: { email: { in: TEST_ACCOUNTS }, role: { not: "ADMIN" } }, select: { id: true, email: true } }),
  prisma.user.findMany({ where: { email: { startsWith: "demo.", endsWith: "@acco-lab.fr" }, role: { not: "ADMIN" } }, select: { id: true, email: true } }),
  prisma.client.findMany({ where: { name: { in: DEMO_CLIENTS } }, select: { id: true, name: true } }),
  prisma.review.count({ where: { source: "DEMO" } }),
  prisma.site.findMany({ where: { searchConsoleProp: null, searchStats: { some: {} } }, select: { id: true, name: true, _count: { select: { searchStats: true } } } }),
]);
const accounts = [...testUsers, ...demoUsers];
// Fiches créées à la main (ni importées de l'ancien CRM, ni venues du coffre à leads) : souvent des essais.
const fichesMain = await prisma.prospect.findMany({ where: { legacyId: null, lead: null }, select: { id: true, societe: true, contacts: { take: 1, select: { prenom: true, nom: true } } } });
// Pour information : abonnements actifs du client « Acco » (le client qui servait de test), à résilier à la main s'ils étaient pour essayer.
const accoSubs = await prisma.subscription.findMany({ where: { status: "ACTIF", client: { name: "Acco" } }, select: { label: true } });

console.log("\nDonnées de test trouvées :");
console.log(`  • CRM : ${prospects} prospect(s) de test, ${projets} projet(s) de test`);
console.log(`  • Comptes de connexion de test / démo : ${accounts.map((u) => u.email).join(", ") || "aucun"}`);
console.log(`  • Clients de démo : ${demoClients.map((c) => c.name).join(", ") || "aucun"}`);
console.log(`  • Avis d’exemple : ${demoReviews}`);
console.log(`  • Chiffres Search Console de démo : ${demoSites.map((s) => `${s.name} (${s._count.searchStats} mois)`).join(", ") || "aucun"}`);
console.log(`  • Fiches CRM créées à la main : ${fichesMain.map((f) => [f.contacts[0]?.prenom, f.contacts[0]?.nom].filter(Boolean).join(" ") + ` (${f.societe})`).join(", ") || "aucune"}${fichesMain.length ? manuelles ? "  → supprimées" : "  → gardées (ajoutez --avec-fiches-manuelles pour les retirer)" : ""}`);
if (accoSubs.length) console.log(`\n  (Non touché) Abonnements actifs du client Acco : ${accoSubs.map((s) => s.label).join(", ")}. Résiliez-les depuis sa fiche s’ils étaient pour essayer.`);

if (!confirm) {
  console.log("\nAperçu seulement, rien n'a été supprimé. Pour supprimer : ajouter --confirmer\n");
  await prisma.$disconnect();
  process.exit(0);
}

// 1. CRM
const [p, pr] = await prisma.$transaction([
  prisma.prospect.deleteMany({ where: { legacyId: { startsWith: "test-" } } }),
  prisma.projet.deleteMany({ where: { legacyId: { startsWith: "test-" } } }),
]);
if (manuelles && fichesMain.length) {
  const fm = await prisma.prospect.deleteMany({ where: { id: { in: fichesMain.map((f) => f.id) } } });
  console.log(`✓ ${fm.count} fiche(s) créée(s) à la main supprimée(s)`);
}
const cibles = await prisma.cible.deleteMany({ where: { prospects: { none: {} } } });
console.log(`✓ CRM : ${p.count} prospect(s) et ${pr.count} projet(s) de test supprimés, ${cibles.count} cible(s) inutilisée(s) retirée(s)`);

// 2 et 3. Clients de démo (tout suit en cascade) puis comptes de test
const dc = await prisma.client.deleteMany({ where: { id: { in: demoClients.map((c) => c.id) } } });
await prisma.user.deleteMany({ where: { id: { in: accounts.map((u) => u.id) } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && key) {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  for (const u of accounts) {
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error && !/not.?found/i.test(error.message)) console.log(`⚠ Connexion de ${u.email} : ${error.message}`);
  }
} else if (accounts.length) console.log("⚠ Connexions Supabase non supprimées (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)");
console.log(`✓ ${dc.count} client(s) de démo et ${accounts.length} compte(s) de test supprimés`);

// 4. Avis d'exemple
const sitesAvis = await prisma.review.findMany({ where: { source: "DEMO" }, distinct: ["siteId"], select: { siteId: true } });
const rv = await prisma.review.deleteMany({ where: { source: "DEMO" } });
await prisma.site.updateMany({ where: { id: { in: sitesAvis.map((s) => s.siteId) } }, data: { reviewAverage: null, reviewTotal: null, reviewsSyncedAt: null } });
console.log(`✓ ${rv.count} avis d’exemple supprimé(s)`);

// 5. Chiffres de démo
const ids = demoSites.map((s) => s.id);
const [st, rc] = await prisma.$transaction([
  prisma.searchStatsMonthly.deleteMany({ where: { siteId: { in: ids } } }),
  prisma.monthlyRecap.deleteMany({ where: { siteId: { in: ids }, sentAt: null } }),
]);
console.log(`✓ ${st.count} mois de chiffres de démo et ${rc.count} récap(s) non envoyé(s) supprimés\nTerminé : l’app est prête.\n`);
await prisma.$disconnect();
