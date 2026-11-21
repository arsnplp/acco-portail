"use server";

import { revalidatePath } from "next/cache";
import type { DifficulteType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import { DIFFICULTE_TYPE, signalerDifficulte } from "@/lib/difficultes";

export type DifficulteState = { error?: string; ok?: string };

export async function signalerDifficulteAction(_prev: DifficulteState, fd: FormData): Promise<DifficulteState> {
  const { client, user } = await requireClientContext();
  const type = String(fd.get("type") ?? "AUTRE") as DifficulteType;
  if (!(type in DIFFICULTE_TYPE)) return { error: "Choisissez un type." };
  const siteId = String(fd.get("siteId") ?? "") || null;
  if (siteId && !(await prisma.site.findFirst({ where: { id: siteId, clientId: client.id }, select: { id: true } }))) return { error: "Site inconnu." };
  try {
    await signalerDifficulte({ clientId: client.id, userId: user.id, siteId, type, message: String(fd.get("message") ?? "") });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/difficultes"); revalidatePath("/"); revalidatePath("/admin", "layout");
  return { ok: "Bien reçu. On revient vers vous rapidement." };
}
