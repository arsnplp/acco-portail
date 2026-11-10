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
  const cs = s.c.split(",").filter((x) => x && x !== "all");
  const cibles = s.cible.split(",").filter(Boolean);
  return {
    statut: s.statut,
    // Plusieurs commerciaux ou cibles séparés par des virgules (filtres à choix multiples du pipeline).
    ...(cs.length ? { OR: cs.map((c) => (c === "me" ? { commercialId: meId } : c === "none" ? { commercialId: null } : { commercialId: c })) } : {}),
    ...(cibles.length ? { cible: { nom: { in: cibles } } } : {}),
    id: { notIn: s.skip },
    // Déjà traité aujourd'hui par moi : on passe. La note automatique posée à l'envoi d'une liste du coffre (origine « lead ») ne compte pas.
    echanges: { none: { auteurId: meId, date: { gte: todayStart }, NOT: { origine: "lead" } } },
  };
}
