/** Relie chaque site sans contrat au contrat signé de son client (quand il n'y en a qu'un). Relançable. */
import { prisma } from "../src/lib/prisma";
async function main() {
  const sites = await prisma.site.findMany({ where: { contratId: null, client: { archivedAt: null } }, select: { id: true, name: true, client: { select: { name: true, contrats: { where: { statut: "SIGNE" }, select: { id: true, reference: true, siteId: true } } } } } });
  for (const s of sites) {
    const c = s.client.contrats.length === 1 ? s.client.contrats[0] : s.client.contrats.find((x) => x.siteId === s.id);
    if (!c) { console.log(`- ${s.name} (${s.client.name}) : ${s.client.contrats.length ? "plusieurs contrats, à choisir à la main" : "aucun contrat signé"}`); continue; }
    await prisma.site.update({ where: { id: s.id }, data: { contratId: c.id } });
    if (!c.siteId) await prisma.contrat.update({ where: { id: c.id }, data: { siteId: s.id } });
    console.log(`✓ ${s.name} → ${c.reference}`);
  }
}
main().finally(() => prisma.$disconnect());
