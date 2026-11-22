"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import { notifyAdmins, excerpt } from "@/lib/notify";
import { logActivite } from "@/lib/activite";

export type CreationState = { error?: string; ok?: string };

/** Studio → Créer : le client décrit le support voulu ; la demande part dans sa conversation et prévient l'équipe. */
export async function demanderCreation(_prev: CreationState, fd: FormData): Promise<CreationState> {
  const { client, user } = await requireClientContext();
  const format = String(fd.get("format") ?? "").trim().slice(0, 60);
  const titre = String(fd.get("titre") ?? "").trim().slice(0, 160);
  const idee = String(fd.get("idee") ?? "").trim().slice(0, 2000);
  if (!format || !titre || !idee) return { error: "Format, titre et description sont nécessaires." };
  const conv = await prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {} });
  const now = new Date();
  const body = `Demande de création (Studio) · ${format}\nTitre : ${titre}\n${idee}`;
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conv.id, authorId: user.id, body } }),
    prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, clientReadAt: now } }),
  ]);
  await logActivite({ kind: "creation", texte: `Création demandée : ${format} · ${titre}`, href: `/admin/messages/${client.id}`, userId: user.id, clientId: client.id });
  after(() => notifyAdmins({ pref: "messages", tag: `creation-${client.id}`, href: `/admin/messages/${client.id}`, title: `Création demandée · ${client.name}`, body: excerpt(`${format} : ${titre}`) }));
  revalidatePath("/messages"); revalidatePath("/admin/messages");
  return { ok: "Demande envoyée : votre équipe revient vers vous dans Messages avec une proposition." };
}
