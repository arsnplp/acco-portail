"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notifyClient } from "@/lib/notify";
import { activePromo } from "@/lib/offers";
import { fmtPrice } from "@/lib/format";

function revalidate(clientId: string, siteId?: string | null) {
  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
  revalidatePath("/admin/suivi");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/offres");
  revalidatePath("/compte");
  if (siteId) revalidatePath(`/sites/${siteId}`, "layout");
}

/** Valider une commande : crée l'abonnement (et débloque le module sur le site choisi), prévient le client. */
export async function validateOrder(orderId: string, formData: FormData) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { offer: { include: { promotions: true } }, site: true } });
  if (!order || order.status !== "A_TRAITER") return;
  const siteId = String(formData.get("siteId") ?? "") || order.siteId;
  if (order.offer.module !== "NONE" && !siteId) return;
  const promo = activePromo(order.offer);
  const price = promo ? promo.price : order.offer.priceCents;
  const commitmentMonths = parseInt(String(formData.get("commitmentMonths") ?? "0"), 10) || 0;

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: "VALIDEE", validatedById: admin.id, validatedAt: new Date(), siteId } }),
    prisma.subscription.create({
      data: {
        clientId: order.clientId, siteId, offerId: order.offerId, label: order.offer.name, module: order.offer.module,
        billing: order.offer.billing, priceCents: price,
        commitmentEndsAt: commitmentMonths > 0 ? new Date(new Date().setMonth(new Date().getMonth() + commitmentMonths)) : null,
      },
    }),
  ]);
  await notifyClient({
    clientId: order.clientId, siteId, kind: "COMMANDE_VALIDEE", pref: "offers",
    title: `${order.offer.name} : c’est activé`,
    body: `${fmtPrice(price)}${order.offer.billing === "MENSUEL" ? " / mois" : ""}${order.offer.module !== "NONE" && siteId ? " · le module est débloqué sur votre site" : ""}`,
    href: order.offer.module !== "NONE" && siteId ? `/sites/${siteId}/avis` : "/compte",
  });
  revalidate(order.clientId, siteId);
}

export async function refuseOrder(orderId: string) {
  const admin = await requireAdmin();
  const order = await prisma.order.update({ where: { id: orderId }, data: { status: "REFUSEE", validatedById: admin.id, validatedAt: new Date() } });
  revalidate(order.clientId, order.siteId);
}
