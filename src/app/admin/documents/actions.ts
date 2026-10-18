"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyClient } from "@/lib/notify";
import { DOC_KIND } from "@/lib/documents";
import type { DocumentKind } from "@prisma/client";

export type ActionState = { error?: string; ok?: boolean };

function revalidate(clientId: string) {
  revalidatePath("/admin/documents");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/documents`);
  revalidatePath("/admin");
  revalidatePath("/compte/documents");
}

export async function uploadDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  const kind = String(formData.get("kind") ?? "AUTRE") as DocumentKind;
  const title = String(formData.get("title") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "") || null;
  const file = formData.get("file");
  if (!clientId || !title || !(file instanceof File) || file.size === 0) return { error: "Titre et fichier requis" };
  if (siteId && !(await prisma.site.findFirst({ where: { id: siteId, clientId }, select: { id: true } }))) return { error: "Ce site n’appartient pas à ce client" };

  let storagePath: string;
  try {
    storagePath = await uploadFile("documents", clientId, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fichier refusé" };
  }
  const doc = await prisma.document.create({ data: { clientId, siteId, kind, title, storagePath, fileName: file.name, sizeBytes: file.size } });

  if (requestId) {
    const req = await prisma.documentRequest.findFirst({ where: { id: requestId, clientId, status: "EN_ATTENTE" } });
    if (req) await prisma.documentRequest.update({ where: { id: req.id }, data: { status: "TERMINEE", fulfilledAt: new Date(), documentId: doc.id } });
  }

  await notifyClient({
    clientId, siteId, kind: "DOCUMENT_DISPONIBLE", pref: "messages",
    title: requestId ? "Votre document est disponible" : `Nouveau document : ${DOC_KIND[kind].label.toLowerCase()}`,
    body: title, href: "/compte/documents",
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteDocument(docId: string) {
  await requireAdmin();
  const doc = await prisma.document.delete({ where: { id: docId } });
  await createSupabaseAdmin().storage.from("documents").remove([doc.storagePath]);
  revalidate(doc.clientId);
}

/** Clore une demande sans fichier (ex. document déjà envoyé par un autre canal). */
export async function closeRequest(requestId: string) {
  await requireAdmin();
  const req = await prisma.documentRequest.update({ where: { id: requestId }, data: { status: "TERMINEE", fulfilledAt: new Date() } });
  revalidate(req.clientId);
}
