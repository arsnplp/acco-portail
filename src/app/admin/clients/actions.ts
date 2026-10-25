"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ensureAuthUser, sendInvitationEmail } from "@/lib/invitations";

export type ActionState = { error?: string };

const clientSchema = z.object({
  name: z.string().trim().min(2, "Nom de l’entreprise requis"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  siren: z.string().trim().optional(),
  ownerEmail: z.string().trim().email("Email du gérant invalide"),
  ownerFirstName: z.string().trim().min(1, "Prénom du gérant requis"),
  ownerLastName: z.string().trim().optional(),
});

export async function createClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ownerEmail = d.ownerEmail.toLowerCase();

  let userId: string;
  try {
    userId = await ensureAuthUser(ownerEmail, { first_name: d.ownerFirstName, last_name: d.ownerLastName });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossible de créer le compte" };
  }

  const client = await prisma.client.create({
    data: {
      name: d.name,
      address: d.address || null,
      phone: d.phone || null,
      email: d.email || null,
      siren: d.siren || null,
      conversation: { create: {} },
      memberships: {
        create: {
          role: "OWNER",
          user: {
            connectOrCreate: {
              where: { id: userId },
              create: { id: userId, email: ownerEmail, firstName: d.ownerFirstName, lastName: d.ownerLastName || null, role: "CLIENT" },
            },
          },
        },
      },
    },
  });
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${client.id}`);
}

export async function updateClient(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const d = Object.fromEntries(formData) as Record<string, string>;
  if (!d.name?.trim()) return { error: "Nom requis" };
  await prisma.client.update({
    where: { id: clientId },
    data: { name: d.name.trim(), address: d.address?.trim() || null, phone: d.phone?.trim() || null, email: d.email?.trim() || null, siren: d.siren?.trim() || null },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function addMember(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!z.string().email().safeParse(email).success) return { error: "Email invalide" };
  let userId: string;
  try {
    userId = await ensureAuthUser(email, { first_name: firstName });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossible de créer le compte" };
  }
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId, email, firstName: firstName || null, role: "CLIENT" }, update: {} });
  await prisma.clientMembership.upsert({ where: { clientId_userId: { clientId, userId } }, create: { clientId, userId, role: "MEMBER" }, update: {} });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function createSite(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) return { error: "Nom du site requis (ex. boulangerie-dupont.fr)" };
  const site = await prisma.site.create({
    data: {
      clientId,
      name,
      status: "EN_CREATION",
      projectStep: "BRIEF",
      assets: {
        create: [
          { kind: "LOGO", label: "Votre logo" },
          { kind: "TEXTE", label: "Présentation de l’entreprise" },
          { kind: "PHOTO", label: "Photos (5 à 10)" },
        ],
      },
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/sites/${site.id}`);
}

export async function createSubscription(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const d = Object.fromEntries(formData) as Record<string, string>;
  const price = Math.round(parseFloat((d.price ?? "").replace(",", ".")) * 100);
  if (!d.label?.trim() || !Number.isFinite(price)) return { error: "Libellé et prix requis" };
  await prisma.subscription.create({
    data: {
      clientId,
      siteId: d.siteId || null,
      label: d.label.trim(),
      billing: d.billing === "PONCTUEL" ? "PONCTUEL" : "MENSUEL",
      priceCents: price,
      monthlyQuota: d.monthlyQuota ? parseInt(d.monthlyQuota, 10) : null,
      commitmentEndsAt: d.commitmentEndsAt ? new Date(d.commitmentEndsAt) : null,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function cancelSubscription(clientId: string, subId: string) {
  await requireAdmin();
  await prisma.subscription.update({ where: { id: subId }, data: { status: "RESILIE", cancelledAt: new Date() } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function sendInvitation(clientId: string, userId: string) {
  const admin = await requireAdmin();
  const [client, user] = await Promise.all([prisma.client.findUnique({ where: { id: clientId } }), prisma.user.findUnique({ where: { id: userId } })]);
  if (!client || !user) return;
  await sendInvitationEmail({ email: user.email, firstName: user.firstName, clientName: client.name, clientId, inviterId: admin.id });
  revalidatePath(`/admin/clients/${clientId}`);
}

/**
 * Activer une offre du catalogue pour un client, depuis sa fiche (sans passer par une commande).
 * Le client n'est prévenu que si la case est cochée.
 */
export async function activateOffer(clientId: string, offerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const { activePromo } = await import("@/lib/offers");
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: { promotions: true } });
  if (!offer) return { error: "Offre introuvable" };
  const siteId = String(formData.get("siteId") ?? "") || null;
  if (offer.module !== "NONE" && !siteId) return { error: "Choisissez le site sur lequel débloquer le module." };
  if (siteId && !(await prisma.site.findFirst({ where: { id: siteId, clientId }, select: { id: true } }))) return { error: "Site introuvable" };
  const promo = activePromo(offer);
  const price = promo ? promo.price : offer.priceCents;
  const months = parseInt(String(formData.get("commitmentMonths") ?? "0"), 10) || 0;
  await prisma.subscription.create({
    data: {
      clientId, siteId, offerId, label: offer.name, module: offer.module, billing: offer.billing, priceCents: price,
      commitmentEndsAt: months > 0 ? new Date(new Date().setMonth(new Date().getMonth() + months)) : null,
    },
  });
  // Une commande en attente pour cette offre est considérée comme traitée.
  await prisma.order.updateMany({ where: { clientId, offerId, status: "A_TRAITER" }, data: { status: "VALIDEE", validatedAt: new Date() } });
  if (formData.get("notify") === "on") {
    const { notifyClient } = await import("@/lib/notify");
    const { fmtPrice } = await import("@/lib/format");
    await notifyClient({
      clientId, siteId, kind: "COMMANDE_VALIDEE", pref: "offers",
      title: `${offer.name} : c’est activé`,
      body: `${fmtPrice(price)}${offer.billing === "MENSUEL" ? " / mois" : ""}`,
      href: offer.module !== "NONE" && siteId ? `/sites/${siteId}/avis` : "/compte",
    });
  }
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  revalidatePath("/compte");
  if (siteId) revalidatePath(`/sites/${siteId}`, "layout");
  return {};
}
