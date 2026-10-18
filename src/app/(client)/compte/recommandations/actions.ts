"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";

export type RefState = { error?: string; ok?: boolean };

export async function recommendContact(_prev: RefState, formData: FormData): Promise<RefState> {
  const { client } = await requireClientContext();
  const d = Object.fromEntries(formData) as Record<string, string>;
  const name = d.contactName?.trim();
  const phone = d.contactPhone?.trim() || null;
  const email = d.contactEmail?.trim().toLowerCase() || null;
  if (!name) return { error: "Le nom du contact est requis." };
  if (!phone && !email) return { error: "Indiquez au moins un téléphone ou un email." };
  if (email && !z.string().email().safeParse(email).success) return { error: "Email invalide." };
  await prisma.referral.create({ data: { referrerClientId: client.id, kind: "CONTACT", contactName: name, contactPhone: phone, contactEmail: email, note: d.note?.trim().slice(0, 500) || null } });
  revalidatePath("/compte/recommandations");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
