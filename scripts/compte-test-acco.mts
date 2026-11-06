/** Le client « Acco » du portail devient notre compte test : client.test@acco-lab.fr en est le propriétaire ; la Boulangerie Test (démo) est archivée. */
import { prisma } from "../src/lib/prisma";
async function main() {
  const acco = await prisma.client.findFirstOrThrow({ where: { name: { in: ["Acco", "Acco Lab", "ACCO LAB"] }, archivedAt: null }, select: { id: true, name: true } });
  const u = await prisma.user.findUniqueOrThrow({ where: { email: "client.test@acco-lab.fr" }, select: { id: true } });
  await prisma.clientMembership.upsert({ where: { clientId_userId: { clientId: acco.id, userId: u.id } }, create: { clientId: acco.id, userId: u.id, role: "OWNER" }, update: { role: "OWNER" } });
  await prisma.conversation.upsert({ where: { clientId: acco.id }, create: { clientId: acco.id }, update: {} });
  await prisma.client.update({ where: { id: acco.id }, data: { name: "Acco Lab", gmbUrl: "https://share.google/Xv2eOm8Ejj6K4oXLY" } });
  const demo = await prisma.client.findFirst({ where: { name: { startsWith: "Boulangerie Test" }, archivedAt: null }, select: { id: true } });
  if (demo) {
    await prisma.clientMembership.deleteMany({ where: { clientId: demo.id, userId: u.id } });
    await prisma.client.update({ where: { id: demo.id }, data: { archivedAt: new Date(), statut: "ARCHIVE" } });
  }
  console.log("OK : client.test@acco-lab.fr → Acco Lab ; Boulangerie Test (démo)", demo ? "archivée" : "absente");
}
main().finally(() => prisma.$disconnect());
