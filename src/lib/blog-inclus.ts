import { prisma } from "@/lib/prisma";

/** Le blog est inclus si un abonnement actif du site (ou du client) parle de blog, articles, contenu ou rédaction. */
export async function blogInclus(siteId: string, clientId: string) {
  const subs = await prisma.subscription.findMany({ where: { status: "ACTIF", OR: [{ siteId }, { siteId: null, clientId }] }, select: { label: true, offer: { select: { name: true } } } });
  return subs.some((s) => /blog|article|contenu|rédac|redac/.test(`${s.label} ${s.offer?.name ?? ""}`.toLowerCase()));
}
