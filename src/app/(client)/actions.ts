"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";

export async function answerReviewPrompt(promptId: string, action: "click" | "later") {
  const { client } = await requireClientContext();
  await prisma.reviewPrompt.updateMany({ where: { id: promptId, clientId: client.id, state: "AFFICHEE" }, data: { state: action === "click" ? "CLIQUEE" : "IGNOREE", actedAt: new Date() } });
  revalidatePath("/");
  if (action === "click") {
    const url = (await prisma.setting.findUnique({ where: { key: "google_review_url" } }))?.value;
    if (url) redirect(url);
  }
}
