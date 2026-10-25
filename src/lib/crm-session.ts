import type { Prisma, ProspectStatut } from "@prisma/client";
import { PIPELINE } from "@/lib/crm";

/** Une session d'appels = une colonne du pipeline, avec les mêmes filtres que l'écran (commercial, cible). */
export type SessionParams = { statut: ProspectStatut; c: string; cible: string; skip: string[] };

export function readSession(sp: Record<string, string | undefined>): SessionParams | null {
  const statut = sp.statut as ProspectStatut | undefined;
  if (!statut || !PIPELINE.includes(statut)) return null;
  return { statut, c: sp.c || "all", cible: sp.cible || "", skip: sp.skip?.split(",").filter(Boolean) ?? [] };
}

export function sessionQuery(s: SessionParams, extraSkip?: string) {
  const skip = extraSkip ? [...s.skip, extraSkip] : s.skip;
  const q = new URLSearchParams({ statut: s.statut, c: s.c });
  if (s.cible) q.set("cible", s.cible);
  if (skip.length) q.set("skip", skip.join(","));
  return q.toString();
}

export function sessionWhere(s: SessionParams, meId: string, todayStart: Date): Prisma.ProspectWhereInput {
  return {
    statut: s.statut,
    ...(s.c === "me" ? { commercialId: meId } : s.c === "none" ? { commercialId: null } : s.c !== "all" ? { commercialId: s.c } : {}),
    ...(s.cible ? { cible: { nom: s.cible } } : {}),
    id: { notIn: s.skip },
    echanges: { none: { auteurId: meId, date: { gte: todayStart } } }, // déjà traité aujourd'hui par moi : on passe
  };
}
