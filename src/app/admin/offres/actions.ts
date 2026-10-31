"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProspection } from "@/lib/auth";
import type { Billing, Module } from "@prisma/client";

export type ActionState = { error?: string; ok?: boolean };

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
const toCents = (v: string | undefined) => { if (!v?.trim()) return null; const n = Math.round(parseFloat(v.replace(",", ".")) * 100); return Number.isFinite(n) ? n : null; };

function parseOffer(formData: FormData) {
  const d = Object.fromEntries(formData) as Record<string, string>;
  const priceCents = toCents(d.price);
  if (!d.name?.trim() || !d.benefit?.trim() || priceCents === null) return { error: "Nom, bénéfice et prix requis" };
  return {
    data: {
      name: d.name.trim(),
      benefit: d.benefit.trim(),
      description: d.description?.trim() || null,
      priceCents,
      setupCents: toCents(d.setup),
      billing: (d.billing === "PONCTUEL" ? "PONCTUEL" : "MENSUEL") as Billing,
      module: (d.module === "AVIS" ? "AVIS" : "NONE") as Module,
      order: parseInt(d.order || "0", 10) || 0,
      parentId: d.parentId?.trim() || null,
    },
  };
}

function revalidate() {
  revalidatePath("/admin/offres");
  revalidatePath("/offres");
}

export async function createOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProspection();
  const r = parseOffer(formData);
  if ("error" in r) return { error: r.error };
  let slug = slugify(r.data.name) || "offre";
  if (await prisma.offer.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const offer = await prisma.offer.create({ data: { ...r.data, slug } });
  revalidate();
  redirect(`/admin/offres/${offer.id}`);
}

export async function updateOffer(offerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProspection();
  const r = parseOffer(formData);
  if ("error" in r) return { error: r.error };
  if (r.data.parentId === offerId) return { error: "Une offre ne peut pas être son propre complément." };
  await prisma.offer.update({ where: { id: offerId }, data: r.data });
  revalidate();
  return { ok: true };
}

export async function toggleArchive(offerId: string) {
  await requireProspection();
  const o = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
  await prisma.offer.update({ where: { id: offerId }, data: { isArchived: !o.isArchived } });
  revalidate();
}

export async function createPromotion(offerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProspection();
  const d = Object.fromEntries(formData) as Record<string, string>;
  const promoPriceCents = toCents(d.promoPrice);
  const percentOff = d.percentOff ? parseInt(d.percentOff, 10) : null;
  if (!d.label?.trim() || !d.endsAt) return { error: "Libellé et date de fin requis" };
  if (promoPriceCents === null && !percentOff) return { error: "Indiquez un prix promo ou un pourcentage" };
  await prisma.promotion.create({ data: { offerId, label: d.label.trim(), promoPriceCents, percentOff: promoPriceCents === null ? percentOff : null, endsAt: new Date(d.endsAt + "T23:59:59") } });
  revalidate();
  revalidatePath(`/admin/offres/${offerId}`);
  return { ok: true };
}

export async function deletePromotion(offerId: string, promoId: string) {
  await requireProspection();
  await prisma.promotion.delete({ where: { id: promoId } });
  revalidate();
  revalidatePath(`/admin/offres/${offerId}`);
}
