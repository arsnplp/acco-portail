import { prisma } from "@/lib/prisma";

export type PromptTrigger = "SITE_EN_LIGNE" | "MODIFICATION_CONFIRMEE" | "RECAP_POSITIF";

/**
 * Propose « Noter Acco » uniquement après un moment positif.
 * Règles : jamais après un clic ; après un « plus tard », une seule nouvelle fois, au plus tôt 60 jours après ; une seule carte en attente à la fois.
 */
export async function maybeCreateReviewPrompt(clientId: string, trigger: PromptTrigger) {
  const prompts = await prisma.reviewPrompt.findMany({ where: { clientId }, orderBy: { shownAt: "desc" } });
  if (prompts.some((p) => p.state === "CLIQUEE")) return null;
  if (prompts.some((p) => p.state === "AFFICHEE")) return null;
  const ignored = prompts.filter((p) => p.state === "IGNOREE");
  if (ignored.length >= 2) return null;
  if (ignored[0] && Date.now() - (ignored[0].actedAt ?? ignored[0].shownAt).getTime() < 60 * 86400_000) return null;
  return prisma.reviewPrompt.create({ data: { clientId, trigger } });
}

export async function pendingReviewPrompt(clientId: string) {
  return prisma.reviewPrompt.findFirst({ where: { clientId, state: "AFFICHEE" }, orderBy: { shownAt: "desc" } });
}
