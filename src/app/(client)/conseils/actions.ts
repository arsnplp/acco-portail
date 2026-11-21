"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";

/** « Personnaliser ces conseils » : Claude reformule pour chaque site du client (sous interrupteur et plafond IA). */
export async function personnaliserConseilsTousAction(): Promise<{ error?: string }> {
  const { client, user } = await requireClientContext();
  const { personnaliserConseils } = await import("@/lib/conseils");
  const sites = await prisma.site.findMany({ where: { clientId: client.id }, select: { id: true } });
  for (const s of sites) {
    const r = await personnaliserConseils(s.id, user.id);
    if (!r.ok) { revalidatePath("/conseils"); return { error: r.error }; }
  }
  revalidatePath("/conseils");
  return {};
}
