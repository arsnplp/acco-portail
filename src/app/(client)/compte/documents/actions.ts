"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { after } from "next/server";
import { notifyAdmins, excerpt } from "@/lib/notify";

/** Le client dépose un document que l'équipe lui a demandé. */
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
  after(() => notifyAdmins({ pref: "documents", tag: `doc-${doc.id}`, href: `/admin/clients/${client.id}/documents`, title: `Document reçu · ${client.name}`, body: excerpt(doc.title) }));
  revalidatePath("/compte/documents");
  revalidatePath("/admin", "layout");
}
