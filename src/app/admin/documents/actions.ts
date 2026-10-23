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
  const file = formData.get("file");
  if (!clientId || !title || !(file instanceof File) || file.size === 0) return { error: "Titre et fichier requis" };
  if (siteId && !(await prisma.site.findFirst({ where: { id: siteId, clientId }, select: { id: true } }))) return { error: "Ce site n’appartient pas à ce client" };

  let storagePath: string;
  try {
    storagePath = await uploadFile("documents", clientId, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fichier refusé" };
  }
  await prisma.document.create({ data: { clientId, siteId, kind, title, storagePath, fileName: file.name, sizeBytes: file.size } });

  await notifyClient({
    clientId, siteId, kind: "DOCUMENT_DISPONIBLE", pref: "documents",
    title: `Nouveau document : ${DOC_KIND[kind].label.toLowerCase()}`,
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

/** L'équipe demande un document au client (Kbis, RIB, logo…). Le client le dépose depuis son espace. */
export async function askClientDocument(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") ?? "AUTRE") as DocumentKind;
  const message = String(formData.get("message") ?? "").trim().slice(0, 300);
  const siteId = String(formData.get("siteId") ?? "") || null;
  if (!message) return { error: "Dites quel document vous attendez (ex. « Kbis de moins de 3 mois »)." };
  await prisma.documentRequest.create({ data: { clientId, siteId, kind, message, direction: "VERS_CLIENT", requestedBy: admin.id } });
  await notifyClient({
    clientId, siteId, kind: "DOCUMENT_DEMANDE", pref: "documents",
    title: "Acco a besoin d’un document",
    body: message, href: "/compte/documents",
    emailSubject: `Un document à nous envoyer : ${message}`,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function cancelRequest(requestId: string) {
  await requireAdmin();
  const req = await prisma.documentRequest.delete({ where: { id: requestId } });
  revalidate(req.clientId);
}
