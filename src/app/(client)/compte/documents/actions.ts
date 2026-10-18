"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import type { DocumentKind } from "@prisma/client";
import { uploadFile } from "@/lib/storage";

export type ActionState = { error?: string; ok?: boolean };

export async function requestDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, client } = await requireClientContext();
  const kind = String(formData.get("kind") ?? "") as DocumentKind;
  if (!["CONTRAT", "FACTURE", "DEVIS", "AUTRE"].includes(kind)) return { error: "Choisissez un type de document." };
  const siteId = String(formData.get("siteId") ?? "") || null;
  const message = String(formData.get("message") ?? "").trim().slice(0, 500) || null;
  if (kind === "AUTRE" && !message) return { error: "Précisez quel document vous souhaitez." };
  if (siteId && !(await prisma.site.findFirst({ where: { id: siteId, clientId: client.id }, select: { id: true } }))) return { error: "Site invalide." };
  await prisma.documentRequest.create({ data: { clientId: client.id, siteId, kind, message, requestedBy: user.id } });
  revalidatePath("/compte/documents");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function uploadRequestedDocument(requestId: string, formData: FormData) {
  const { client } = await requireClientContext();
  const req = await prisma.documentRequest.findFirst({ where: { id: requestId, clientId: client.id, direction: "VERS_CLIENT", status: "EN_ATTENTE" } });
  const file = formData.get("file");
  if (!req || !(file instanceof File) || file.size === 0) return;
  const storagePath = await uploadFile("documents", client.id, file);
  const doc = await prisma.document.create({
    data: { clientId: client.id, siteId: req.siteId, kind: req.kind, title: req.message ?? file.name, storagePath, fileName: file.name, sizeBytes: file.size, uploadedByClient: true },
  });
  await prisma.documentRequest.update({ where: { id: req.id }, data: { status: "TERMINEE", fulfilledAt: new Date(), documentId: doc.id } });
  revalidatePath("/compte/documents");
  revalidatePath("/admin", "layout");
}
