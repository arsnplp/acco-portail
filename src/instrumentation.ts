/** Au démarrage du serveur : boucle des rappels de relance (espace Commercial). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.env.RAPPELS_OFF) return;
  const { startRappelsTicker } = await import("./lib/crm-rappels");
  startRappelsTicker();
}
