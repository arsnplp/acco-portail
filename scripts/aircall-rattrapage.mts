/**
 * Rattrapage Aircall : complète enregistrement, résumé, sujets, sentiment et transcription des appels déjà en base
 * (écrits en « métadonnées seulement » entre le 2 et le 5 nov. 2026, ou analyses jamais relevées).
 * Usage : npx tsx --env-file=.env --tsconfig tsconfig.json scripts/aircall-rattrapage.mts [jours=30] [--dry]
 * Respecte le quota Aircall (120 requêtes/min) : 12 appels par lot, pause entre les lots.
 */
import { prisma } from "../src/lib/prisma";
import { rafraichirAnalyses } from "../src/lib/aircall";

const jours = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 30);
const dry = process.argv.includes("--dry");
const depuis = new Date(Date.now() - jours * 86400_000);

async function main() {
  // 1. Marquer « analyse en attente » les appels répondus (≥ 20 s) sans analyse relevée.
  const candidats = await prisma.echange.findMany({
    where: { externalId: { startsWith: "aircall:" }, date: { gte: depuis }, meta: { path: ["repondu"], equals: true } },
    select: { id: true, meta: true, date: true },
  });
  const aFaire = candidats.filter((e) => {
    const m = e.meta as { dureeSec: number; resume?: string | null; analysePending?: boolean; enregistrement?: boolean };
    return m.dureeSec >= 20 && !m.resume && (m.enregistrement === undefined || !m.analysePending);
  });
  console.log(`${candidats.length} appels répondus depuis ${jours} j, ${aFaire.length} à compléter${dry ? " (simulation, rien n’est écrit)" : ""}.`);
  if (dry) return;
  for (const e of aFaire) await prisma.echange.update({ where: { id: e.id }, data: { meta: { ...(e.meta as object), analysePending: true } } });
  // 2. Relever les analyses par lots de 12 (≈ 60 requêtes), avec une pause de 40 s entre deux lots.
  let total = 0;
  for (let lot = 0; lot < 50; lot++) {
    const n = await rafraichirAnalyses({ depuis, limite: 12 });
    total += n;
    const restant = await prisma.echange.count({ where: { externalId: { startsWith: "aircall:" }, date: { gte: depuis }, meta: { path: ["analysePending"], equals: true } } });
    console.log(`lot ${lot + 1} : ${n} appels mis à jour, ${restant} encore en attente`);
    if (restant === 0 || n === 0) break;
    await new Promise((r) => setTimeout(r, 40_000));
  }
  // 3. Les appels dont Aircall n'a produit aucune analyse (anciens, hors fenêtre de 48 h) ne doivent plus être repassés.
  const vieux = await prisma.echange.findMany({ where: { externalId: { startsWith: "aircall:" }, date: { gte: depuis, lt: new Date(Date.now() - 48 * 3600_000) }, meta: { path: ["analysePending"], equals: true } }, select: { id: true, meta: true } });
  for (const e of vieux) await prisma.echange.update({ where: { id: e.id }, data: { meta: { ...(e.meta as object), analysePending: false } } });
  console.log(`Terminé : ${total} appels complétés, ${vieux.length} sans analyse Aircall (laissés tels quels).`);
}
main().finally(() => prisma.$disconnect());
