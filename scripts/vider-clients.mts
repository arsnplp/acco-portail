/**
 * Supprime TOUS les clients et tout ce qui leur est rattaché (sites, demandes, messages, documents, avis,
 * commandes, abonnements, notifications…), les comptes de connexion des clients (jamais les admins),
 * leurs fichiers stockés et les branches Claude non publiées sur GitHub.
 * Les réglages, offres, guides et comptes admin sont conservés.
 *
 *   npx tsx --env-file=.env scripts/vider-clients.mts              # aperçu, ne supprime rien
 *   npx tsx --env-file=.env scripts/vider-clients.mts --confirmer  # supprime pour de bon
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { deleteRemoteBranch } from "./claude-worker.mts";

const confirm = process.argv.includes("--confirmer");
const prisma = new PrismaClient();

const clients = await prisma.client.findMany({
  include: {
    sites: { include: { _count: { select: { changeRequests: true, reviews: true, contactRequests: true } } } },
    _count: { select: { memberships: true, documents: true, orders: true, subscriptions: true, notifications: true } },
  },
});
const clientUsers = await prisma.user.findMany({ where: { role: { not: "ADMIN" } }, select: { id: true, email: true } });
const branches = await prisma.changeRequest.findMany({
  where: { claudeBranch: { not: null }, claudeMergedAt: null },
  select: { claudeBranch: true, site: { select: { repoUrl: true, name: true } } },
});
const messages = await prisma.message.count();

console.log(`\n${clients.length} client(s) :`);
for (const c of clients) {
  console.log(`  • ${c.name} — ${c.sites.length} site(s), ${c._count.memberships} compte(s), ${c._count.documents} document(s), ${c._count.orders} commande(s)`);
  for (const s of c.sites) console.log(`      - ${s.name} : ${s._count.changeRequests} demande(s), ${s._count.reviews} avis, ${s._count.contactRequests} contact(s)`);
}
console.log(`${messages} message(s) au total`);
console.log(`${clientUsers.length} compte(s) client à supprimer : ${clientUsers.map((u) => u.email).join(", ") || "aucun"}`);
console.log(`${branches.length} branche(s) Claude non publiée(s) : ${branches.map((b) => `${b.site.name}:${b.claudeBranch}`).join(", ") || "aucune"}`);

if (!confirm) {
  console.log("\nAperçu seulement, rien n'a été supprimé. Pour supprimer : ajouter --confirmer\n");
  await prisma.$disconnect();
  process.exit(0);
}

// 1. Fichiers stockés (avant de perdre les identifiants)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
if (supabase) {
  const folders: Array<[string, string]> = [];
  for (const c of clients) {
    folders.push(["documents", c.id], ["messages", c.id]);
    for (const s of c.sites) folders.push(["site-assets", s.id], ["change-requests", s.id]);
  }
  let removed = 0;
  for (const [bucket, folder] of folders) {
    const { data } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${folder}/${f.name}`);
    if (paths.length) { await supabase.storage.from(bucket).remove(paths); removed += paths.length; }
  }
  console.log(`✓ ${removed} fichier(s) supprimé(s)`);
} else console.log("⚠ Fichiers non supprimés (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)");

// 2. Branches Claude restées sur GitHub
for (const b of branches) {
  if (!b.site.repoUrl || !b.claudeBranch) continue;
  try { await deleteRemoteBranch(b.site.repoUrl, b.claudeBranch); console.log(`✓ Branche supprimée : ${b.site.name} ${b.claudeBranch}`); }
  catch (e) { console.log(`⚠ Branche ${b.claudeBranch} : ${(e as Error).message}`); }
}

// 3. Base : clients (tout le reste suit en cascade), puis comptes clients
const del = await prisma.client.deleteMany({});
console.log(`✓ ${del.count} client(s) supprimé(s) avec leurs sites et données`);
await prisma.user.deleteMany({ where: { id: { in: clientUsers.map((u) => u.id) } } });
if (supabase) {
  for (const u of clientUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error && !/not.?found/i.test(error.message)) console.log(`⚠ Connexion de ${u.email} : ${error.message}`);
  }
}
console.log(`✓ ${clientUsers.length} compte(s) client supprimé(s)\nTerminé.\n`);
await prisma.$disconnect();
