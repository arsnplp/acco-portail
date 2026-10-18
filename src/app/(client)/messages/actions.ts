"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";

export async function sendClientMessage(formData: FormData) {
  const { user, client } = await requireClientContext();
  const body = String(formData.get("body") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "") || null;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  if (!body && files.length === 0) return;

  if (siteId) {
    const ok = await prisma.site.findFirst({ where: { id: siteId, clientId: client.id }, select: { id: true } });
    if (!ok) return;
  }
  const attachments = [];
  for (const f of files) attachments.push({ storagePath: await uploadFile("messages", client.id, f), fileName: f.name, mimeType: f.type });

  const conv = await prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {} });
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conv.id, authorId: user.id, siteId, body, attachments: attachments.length ? attachments : undefined } }),
    prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, clientReadAt: now } }),
  ]);
  revalidatePath("/messages");
  revalidatePath("/admin/messages");
}
