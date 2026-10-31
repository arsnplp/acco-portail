import { prisma } from "@/lib/prisma";

/** Ajoute une ligne au flux d'activité de l'agence (Production, Pilotage). Jamais bloquant. */
export async function logActivite(a: { kind: string; texte: string; href?: string | null; userId?: string | null; clientId?: string | null; siteId?: string | null }) {
  try { await prisma.activite.create({ data: { kind: a.kind, texte: a.texte, href: a.href ?? null, userId: a.userId ?? null, clientId: a.clientId ?? null, siteId: a.siteId ?? null } }); }
  catch (e) { console.warn("[activite]", (e as Error).message); }
}
