"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/forms";
import { headers } from "next/headers";
import { after } from "next/server";
import { notifyAdmins, excerpt } from "@/lib/notify";

export type LeadState = { error?: string; ok?: boolean };

export async function submitLead(code: string, _prev: LeadState, formData: FormData): Promise<LeadState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "ip";
  if (!rateLimit(`lead:${ip}`, 5, 3600_000)) return { error: "Trop d’envois, réessayez plus tard." };
  if (String(formData.get("website") ?? "")) return { ok: true }; // robot
  const referrer = await prisma.client.findUnique({ where: { referralCode: code }, select: { id: true, name: true } });
  if (!referrer) return { error: "Lien invalide." };
  const d = Object.fromEntries(formData) as Record<string, string>;
  const name = d.name?.trim(), business = d.business?.trim();
  const phone = d.phone?.trim() || null, email = d.email?.trim().toLowerCase() || null;
  if (!name || !business) return { error: "Votre nom et celui de votre commerce sont requis." };
  if (!phone && !email) return { error: "Indiquez un téléphone ou un email pour qu’on vous rappelle." };
  if (email && !z.string().email().safeParse(email).success) return { error: "Email invalide." };
  await prisma.referral.create({ data: { referrerClientId: referrer.id, kind: "LIEN", contactName: `${business} (${name})`, contactPhone: phone, contactEmail: email, note: d.note?.trim().slice(0, 500) || null } });
  after(() => notifyAdmins({ pref: "referrals", tag: "referral", href: "/admin/recommandations", title: "Nouvelle recommandation (lien de parrainage)", body: excerpt(`${business} via ${referrer.name}`) }));
  return { ok: true };
}
