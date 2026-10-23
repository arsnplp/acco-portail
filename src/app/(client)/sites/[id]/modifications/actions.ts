"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClientSite, changeQuota } from "@/lib/sites";
import { uploadFile } from "@/lib/storage";
import { maybeCreateReviewPrompt } from "@/lib/review-prompt";
import { after } from "next/server";
import { notifyAdmins, excerpt } from "@/lib/notify";

export type ChangeFormState = { error?: string };

const schema = z.object({
  title: z.string().trim().min(3, "Donnez un titre à votre demande.").max(120),
  description: z.string().trim().min(10, "Décrivez un peu plus précisément ce que vous souhaitez.").max(4000),
  page: z.string().trim().max(80).optional(),
  urgency: z.enum(["NORMALE", "URGENTE"]).default("NORMALE"),
});

export async function createChangeRequest(siteId: string, _prev: ChangeFormState, formData: FormData): Promise<ChangeFormState> {
  const { site, client } = await requireClientSite(siteId);
  if (site.status !== "EN_LIGNE") return { error: "Ce site n’est pas encore en ligne." };

  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    page: formData.get("page") || undefined,
    urgency: formData.get("urgency") || "NORMALE",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { quota, used } = await changeQuota(site.id, client.id);
  if (quota !== null && used >= quota) return { error: `Vous avez utilisé vos ${quota} demandes du mois. Écrivez-nous dans Messages si c’est urgent.` };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  const uploaded: { storagePath: string; fileName: string; mimeType: string }[] = [];
  try {
    for (const f of files) uploaded.push({ storagePath: await uploadFile("change-requests", site.id, f), fileName: f.name, mimeType: f.type });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fichier refusé" };
  }

  const cr = await prisma.changeRequest.create({
    data: { siteId: site.id, ...parsed.data, attachments: { create: uploaded } },
  });
  after(() => notifyAdmins({
    pref: "changes", tag: `modif-${cr.id}`, href: "/admin/modifications",
    title: `${cr.urgency === "URGENTE" ? "🔴 Demande urgente" : "Nouvelle demande de modif"} · ${site.name}`,
    body: `${client.name} : ${excerpt(cr.title)}`,
  }));
  revalidatePath(`/sites/${site.id}/modifications`);
  redirect(`/sites/${site.id}/modifications/${cr.id}?creee=1`);
}

export async function confirmChange(siteId: string, reqId: string) {
  const { site, client } = await requireClientSite(siteId);
  const r = await prisma.changeRequest.updateMany({ where: { id: reqId, siteId: site.id, status: "TERMINEE", confirmedAt: null }, data: { confirmedAt: new Date() } });
  if (r.count > 0) await maybeCreateReviewPrompt(client.id, "MODIFICATION_CONFIRMEE");
  revalidatePath(`/sites/${site.id}/modifications`);
  revalidatePath("/");
}

export async function reopenChange(siteId: string, reqId: string, formData: FormData) {
  const { site, user } = await requireClientSite(siteId);
  const reason = String(formData.get("reason") ?? "").trim();
  const cr = await prisma.changeRequest.findFirst({ where: { id: reqId, siteId: site.id, status: "TERMINEE", confirmedAt: null } });
  if (!cr) return;
  await prisma.$transaction([
    prisma.changeRequest.update({ where: { id: cr.id }, data: { status: "EN_COURS", reopenedAt: new Date(), completedAt: null } }),
    prisma.changeRequestComment.create({ data: { changeRequestId: cr.id, authorId: user.id, body: reason ? `Rouverte : ${reason}` : "Rouverte par le client." } }),
  ]);
  after(() => notifyAdmins({ pref: "changes", tag: `modif-${cr.id}`, href: "/admin/modifications", title: `Demande rouverte · ${site.name}`, body: reason ? excerpt(reason) : cr.title }));
  revalidatePath(`/sites/${site.id}/modifications`);
}
