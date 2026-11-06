/** Compte client de test (client.test@acco-lab.fr, OWNER de « Boulangerie Test (démo) »). Usage : PW=motdepasse npx tsx --env-file=.env --tsconfig tsconfig.json scripts/compte-client-test.mts */
import { prisma } from "../src/lib/prisma";
import { createClient } from "@supabase/supabase-js";
const email = "client.test@acco-lab.fr", password = process.env.PW!;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
async function main() {
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  let id = data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (id) { const { error } = await sb.auth.admin.updateUserById(id, { password, email_confirm: true }); if (error) throw error; }
  else { const { data: c, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: "Client", last_name: "Test" } }); if (error) throw error; id = c.user.id; }
  await prisma.user.upsert({ where: { id }, create: { id, email, firstName: "Client", lastName: "Test", role: "CLIENT" }, update: { role: "CLIENT", firstName: "Client", lastName: "Test" } });
  const client = await prisma.client.findFirstOrThrow({ where: { name: { startsWith: "Boulangerie Test" }, archivedAt: null }, select: { id: true, name: true } });
  await prisma.clientMembership.upsert({ where: { clientId_userId: { clientId: client.id, userId: id } }, create: { clientId: client.id, userId: id, role: "OWNER" }, update: { role: "OWNER" } });
  await prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {} });
  console.log("OK :", email, "→", client.name);
}
main().finally(() => prisma.$disconnect());
