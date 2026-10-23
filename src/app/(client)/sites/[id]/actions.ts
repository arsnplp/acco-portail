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
  if (site.projectStep !== "MAQUETTE" || site.mockupValidatedAt) return;
  await prisma.$transaction([
    prisma.site.update({ where: { id: site.id }, data: { mockupValidatedAt: new Date(), projectStep: "DEVELOPPEMENT" } }),
    prisma.siteHistoryEntry.create({
      data: { siteId: site.id, kind: "INTERVENTION", title: "Maquette validée", description: `Validée par ${user.firstName ?? user.email}`, authorId: user.id, items: [] },
    }),
  ]);
  revalidatePath(`/sites/${site.id}`);
}
