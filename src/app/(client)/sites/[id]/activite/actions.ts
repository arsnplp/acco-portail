"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientSite } from "@/lib/sites";
import type { ContactRequestStatus } from "@prisma/client";

export async function setContactStatus(siteId: string, requestId: string, status: ContactRequestStatus) {
  const { site } = await requireClientSite(siteId);
  await prisma.contactRequest.updateMany({ where: { id: requestId, siteId: site.id }, data: { status, handledAt: status === "NOUVELLE" ? null : new Date() } });
  revalidatePath(`/sites/${site.id}/activite`);
}
