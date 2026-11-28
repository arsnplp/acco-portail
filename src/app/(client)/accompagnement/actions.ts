"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import { notifyAdmins, excerpt } from "@/lib/notify";
import { logActivite } from "@/lib/activite";
import { PRESTATIONS, type PrestationKey } from "@/lib/prestations";

export type RdvState = { error?: string; ok?: string };

const FORMATS: Record<string, string> = { visio: "en visioconférence", presentiel: "en présentiel", tel: "par téléphone" };

/** Accompagnement → Prendre rendez-vous : la demande part dans la conversation, le conseiller est prévenu et cale le créneau. */
export async function demanderRdv(_prev: RdvState, fd: FormData): Promise<RdvState> {
  const { client, user } = await requireClientContext();
  const date = String(fd.get("date") ?? "").trim();
  const format = String(fd.get("format") ?? "visio");
  const motif = String(fd.get("motif") ?? "").trim().slice(0, 1000);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Indiquez une date souhaitée." };
  if (!motif) return { error: "Dites-nous en deux mots de quoi vous voulez parler." };
  const quand = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const conv = await prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {} });
  const now = new Date();
  const body = `Demande de rendez-vous · ${quand}, ${FORMATS[format] ?? FORMATS.visio}\n${motif}`;
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conv.id, authorId: user.id, body } }),
    prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, clientReadAt: now } }),
  ]);
  await logActivite({ kind: "demande_rdv", texte: `Rendez-vous demandé : ${quand}`, href: `/admin/messages/${client.id}`, userId: user.id, clientId: client.id });
  after(() => notifyAdmins({ pref: "messages", tag: `rdv-${client.id}`, href: `/admin/messages/${client.id}`, title: `Rendez-vous demandé · ${client.name}`, body: excerpt(`${quand} · ${motif}`) }));
  revalidatePath("/messages"); revalidatePath("/accompagnement"); revalidatePath("/admin/messages");
  return { ok: `Demande envoyée. Votre conseiller vous confirme le créneau dans Messages, généralement dans la journée.` };
}

/** Accompagnement → Nos services : « Demander un devis » sur une prestation, une seule demande par prestation. */
export async function demanderPrestation(key: PrestationKey) {
  const { client, user } = await requireClientContext();
  const p = PRESTATIONS[key];
  if (!p) return;
  const kind = `prestation_${key}`;
  const deja = await prisma.activite.findFirst({ where: { clientId: client.id, kind }, select: { id: true } });
  if (deja) return;
  const conv = await prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {} });
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conv.id, authorId: user.id, body: `Je souhaite un devis pour « ${p.titre} ». Pouvez-vous me dire comment ça se passe et le tarif ?` } }),
    prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, clientReadAt: now } }),
  ]);
  await logActivite({ kind, texte: `Devis demandé : ${p.titre}`, href: `/admin/messages/${client.id}`, userId: user.id, clientId: client.id });
  after(() => notifyAdmins({ pref: "offers", tag: `${kind}-${client.id}`, href: `/admin/messages/${client.id}`, title: `Devis demandé · ${client.name}`, body: `${user.firstName ?? user.email} s’intéresse à « ${p.titre} ».` }));
  revalidatePath("/accompagnement/services"); revalidatePath("/messages"); revalidatePath("/admin/messages");
}
