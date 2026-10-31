"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { notifyClient } from "@/lib/notify";
import { layout, appUrl } from "@/lib/email";

export async function sendTeamMessage(clientId: string, formData: FormData) {
  const admin = await requireTeam();
  const body = String(formData.get("body") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "") || null;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  if (!body && files.length === 0) return;

  const attachments = [];
  for (const f of files) attachments.push({ storagePath: await uploadFile("messages", clientId, f), fileName: f.name, mimeType: f.type });

  const conv = await prisma.conversation.upsert({ where: { clientId }, create: { clientId }, update: {} });
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conv.id, authorId: admin.id, siteId, body, attachments: attachments.length ? attachments : undefined } }),
    prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, teamReadAt: now } }),
  ]);

  const preview = body.length > 140 ? body.slice(0, 140) + "…" : body || "Pièce jointe";
  await notifyClient({
    clientId,
    siteId,
    kind: "MESSAGE_EQUIPE",
    title: `Message de ${admin.firstName ?? "l’équipe Acco"}`,
    body: preview,
    href: "/messages",
    pref: "messages",
    emailSubject: `${admin.firstName ?? "Acco"} vous a écrit`,
    emailHtml: layout(`${admin.firstName ?? "L’équipe Acco"} vous a écrit`, `<p style="white-space:pre-wrap">${escapeHtml(preview)}</p>`, { label: "Répondre", href: appUrl("/messages") }),
  });

  revalidatePath(`/admin/messages/${clientId}`);
  revalidatePath("/admin/messages");
  revalidatePath("/messages");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
