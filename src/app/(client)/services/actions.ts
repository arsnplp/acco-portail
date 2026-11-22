"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { logActivite } from "@/lib/activite";
import { SERVICES, type ServiceKey } from "@/lib/services-client";

/** Le client demande un service non souscrit (fiche Google, publicité) : message dans sa conversation, gestionnaire prévenu, une seule demande. */
export async function demanderService(key: ServiceKey) {
  const { client, user } = await requireClientContext();
  const s = SERVICES[key];
  if (!s.kind) return;
  const deja = await prisma.activite.findFirst({ where: { clientId: client.id, kind: s.kind }, select: { id: true } });
  if (deja) return;
  const conv = await prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {} });
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conv.id, authorId: user.id, body: `Je souhaite en savoir plus sur « ${s.label} » (${s.court.toLowerCase()}). Pouvez-vous me dire comment ça se passe et le tarif ?` } }),
    prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, clientReadAt: now } }),
  ]);
  await logActivite({ kind: s.kind, texte: `Demande du client : ${s.label}`, href: `/admin/messages/${client.id}`, userId: user.id, clientId: client.id });
  after(() => notifyAdmins({ pref: "offers", tag: `${s.kind}-${client.id}`, href: `/admin/messages/${client.id}`, title: `${s.label} demandé · ${client.name}`, body: `${user.firstName ?? user.email} veut en savoir plus.` }));
  revalidatePath("/services"); revalidatePath("/messages"); revalidatePath("/admin/messages");
}
