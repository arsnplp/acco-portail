"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyAdmins } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";

export type OrderState = { error?: string; ok?: boolean };

export async function orderOffer(offerId: string, _prev: OrderState, formData: FormData): Promise<OrderState> {
  const { client } = await requireClientContext();
  const offer = await prisma.offer.findFirst({ where: { id: offerId, isArchived: false } });
  if (!offer) return { error: "Cette offre n’est plus disponible." };
  const siteId = String(formData.get("siteId") ?? "") || null;
  if (offer.module !== "NONE" && !siteId) return { error: "Choisissez le site concerné." };
  if (siteId && !(await prisma.site.findFirst({ where: { id: siteId, clientId: client.id }, select: { id: true } }))) return { error: "Site invalide." };

  const already = await prisma.order.findFirst({ where: { clientId: client.id, offerId, status: "A_TRAITER", siteId } });
  if (already) return { ok: true };
  await prisma.order.create({ data: { clientId: client.id, offerId, siteId, note: String(formData.get("note") ?? "").trim().slice(0, 500) || null } });
  after(() => notifyAdmins({ pref: "offers", tag: "commande", href: "/admin/commandes", title: `Nouvelle commande · ${client.name}`, body: offer.name }));
  revalidatePath("/offres");
  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
  revalidatePath("/admin/suivi");
  return { ok: true };
}
