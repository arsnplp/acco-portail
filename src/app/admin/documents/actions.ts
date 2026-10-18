"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { DocumentKind } from "@prisma/client";

export type ActionState = { error?: string; ok?: boolean };

export async function uploadDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  const kind = String(formData.get("kind") ?? "AUTRE") as DocumentKind;
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");
  if (!clientId || !title || !(file instanceof File) || file.size === 0) return { error: "Client, titre et fichier requis" };
  if (siteId) {
    const ok = await prisma.site.findFirst({ where: { id: siteId, clientId }, select: { id: true } });
    if (!ok) return { error: "Ce site n’appartient pas à ce client" };
  }
  let storagePath: string;
  try {
    storagePath = await uploadFile("documents", clientId, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fichier refusé" };
  }
  await prisma.document.create({ data: { clientId, siteId, kind, title, storagePath, fileName: file.name, sizeBytes: file.size } });
  revalidatePath("/admin/documents");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/compte/documents");
  return { ok: true };
}

export async function deleteDocument(docId: string) {
  await requireAdmin();
  const doc = await prisma.document.delete({ where: { id: docId } });
  await createSupabaseAdmin().storage.from("documents").remove([doc.storagePath]);
  revalidatePath("/admin/documents");
  revalidatePath(`/admin/clients/${doc.clientId}`);
}
