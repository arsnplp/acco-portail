/** Aligne les fiches prospects gagnées et les contrats sur la fiche client : référent, mensuel HT et ponctuel d'après les contrats signés. Relançable. */
import { prisma } from "../src/lib/prisma";
async function main() {
  const ps = await prisma.prospect.findMany({ where: { statut: "GAGNE", clientId: { not: null } }, include: { client: { include: { contrats: { where: { statut: "SIGNE" } } } } } });
  for (const p of ps) {
    const c = p.client!; const mensuel = Math.round(c.contrats.reduce((a, x) => a + x.montantMensuelHt, 0) / 100), ponctuel = Math.round(c.contrats.reduce((a, x) => a + x.montantPonctuelHt, 0) / 100);
    await prisma.prospect.update({ where: { id: p.id }, data: { commercialId: c.commercialId ?? p.commercialId, ...(c.contrats.length ? { mensuelEuros: mensuel, fraisCreationEuros: ponctuel || null } : {}) } });
    if (c.commercialId) await prisma.contrat.updateMany({ where: { clientId: c.id, statut: "SIGNE", commercialId: { not: c.commercialId } }, data: { commercialId: c.commercialId } });
    console.log(`✓ ${p.societe} : ${c.commercialId ? "référent aligné" : "sans référent"}${c.contrats.length ? `, ${mensuel} €/mois HT${ponctuel ? ` + ${ponctuel} € ponctuel` : ""}` : ""}`);
  }
}
main().finally(() => prisma.$disconnect());
