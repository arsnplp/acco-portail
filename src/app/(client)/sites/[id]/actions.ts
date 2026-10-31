"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientSite } from "@/lib/sites";
import { uploadFile } from "@/lib/storage";
import { after } from "next/server";
import { notifyAdmins, excerpt } from "@/lib/notify";

export async function uploadAsset(siteId: string, assetId: string, formData: FormData) {
  const { site } = await requireClientSite(siteId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const asset = await prisma.siteAsset.findFirst({ where: { id: assetId, siteId: site.id } });
  if (!asset) return;
  const storagePath = await uploadFile("site-assets", site.id, file);
  await prisma.siteAsset.update({ where: { id: asset.id }, data: { storagePath, fileName: file.name, uploadedAt: new Date() } });
  after(() => notifyAdmins({ pref: "documents", tag: `asset-${asset.id}`, href: `/admin/sites/${site.id}`, title: `Fichier reçu · ${site.name}`, body: excerpt(file.name) }));
  revalidatePath(`/sites/${site.id}`);
}

export async function validateMockup(siteId: string) {
  const { site, user } = await requireClientSite(siteId);
  // Le client valide la V1 (étape Présentation V1) ou la V2 (étape Validation client) : le site avance d'une colonne.
  const suite = site.projectStep === "PRESENTATION_V1" ? "PEAUFINEMENT" : site.projectStep === "VALIDATION_CLIENT" ? "FINITION" : null;
  if (!suite) return;
  const quoi = site.projectStep === "PRESENTATION_V1" ? "Version 1 validée" : "Version 2 validée";
  await prisma.$transaction([
    prisma.site.update({ where: { id: site.id }, data: { mockupValidatedAt: new Date(), projectStep: suite, etapeAt: new Date() } }),
    prisma.siteHistoryEntry.create({
      data: { siteId: site.id, kind: "INTERVENTION", title: quoi, description: `Validée par ${user.firstName ?? user.email}`, authorId: user.id, items: [] },
    }),
  ]);
  const { logActivite } = await import("@/lib/activite");
  await logActivite({ kind: "validation_client", texte: `${site.name} : ${quoi.toLowerCase()} par le client`, href: `/admin/sites/${site.id}`, clientId: site.clientId, siteId: site.id });
  revalidatePath("/admin/production");
  revalidatePath(`/sites/${site.id}`);
}
