import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";

/** Site appartenant au client courant, sinon 404. */
export async function requireClientSite(siteId: string) {
  const ctx = await requireClientContext();
  const site = await prisma.site.findFirst({ where: { id: siteId, clientId: ctx.client.id } });
  if (!site) notFound();
  return { ...ctx, site };
}

export function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

/** Quota de modifications du mois pour un site (null = illimité). */
export async function changeQuota(siteId: string, clientId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { status: "ACTIF", clientId, OR: [{ siteId }, { siteId: null }], monthlyQuota: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  const { start, end } = monthRange();
  const used = await prisma.changeRequest.count({ where: { siteId, createdAt: { gte: start, lt: end } } });
  return { quota: sub?.monthlyQuota ?? null, used };
}

/** Dernier état connu du site (surveillance). */
export async function siteHealth(siteId: string) {
  const last = await prisma.siteHealthCheck.findFirst({ where: { siteId }, orderBy: { checkedAt: "desc" } });
  if (!last) return null;
  const sslDays = last.sslExpiresAt ? Math.floor((last.sslExpiresAt.getTime() - Date.now()) / 86400_000) : null;
  return {
    up: last.isUp,
    secure: sslDays === null ? null : sslDays > 7,
    fast: last.responseMs === null ? null : last.responseMs < 1500,
    checkedAt: last.checkedAt,
  };
}
