/**
 * Crée (ou réinitialise) un compte de connexion client de test, rattaché à un client existant,
 * pour voir l'espace client comme un vrai client. Affiche l'email et le mot de passe.
 *   npx tsx --env-file=.env scripts/compte-client-test.mts [--client "Acco"] [--email test.client@acco-lab.fr]
 */
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const { values: a } = parseArgs({ options: { client: { type: "string", default: "Acco" }, email: { type: "string", default: "test.client@acco-lab.fr" } } });
const email = a.email!.toLowerCase();
const password = `Test-${randomBytes(6).toString("base64url")}`;

const prisma = new PrismaClient();
const client = await prisma.client.findFirst({ where: { name: a.client } });
if (!client) { console.error(`Client « ${a.client} » introuvable.`); process.exit(1); }
const admin = await prisma.user.findUnique({ where: { email } });
if (admin?.role === "ADMIN") { console.error("Cet email est un compte admin : choisissez-en un autre (--email)."); process.exit(1); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let userId = admin?.id;
if (userId) {
  const { error } = await sb.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (error) { console.error(error.message); process.exit(1); }
} else {
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: "Client test" } });
  if (error || !data.user) { console.error(error?.message ?? "Création impossible"); process.exit(1); }
  userId = data.user.id;
}
await prisma.user.upsert({ where: { id: userId }, create: { id: userId, email, firstName: "Client test", role: "CLIENT" }, update: { email } });
await prisma.clientMembership.upsert({ where: { clientId_userId: { clientId: client.id, userId } }, create: { clientId: client.id, userId, role: "OWNER" }, update: { role: "OWNER" } });

console.log(`✓ Compte client rattaché à « ${client.name} »`);
console.log(`  Adresse : ${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.acco-lab.fr"}/connexion`);
console.log(`  Email   : ${email}`);
console.log(`  Mot de passe : ${password}`);
console.log("  (ouvrir dans une fenêtre de navigation privée pour ne pas déconnecter le compte admin)");
await prisma.$disconnect();
