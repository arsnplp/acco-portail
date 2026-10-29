/** Au démarrage du serveur : boucles des rappels de relance (espace Commercial), des récaps mensuels et de la synchro Aircall. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.env.RAPPELS_OFF) return;
  const { startRappelsTicker } = await import("./lib/crm-rappels");
  startRappelsTicker();
  const { startRecapsTicker } = await import("./lib/recaps");
  startRecapsTicker();
  const { startAircallTicker } = await import("./lib/aircall");
  startAircallTicker();
}
