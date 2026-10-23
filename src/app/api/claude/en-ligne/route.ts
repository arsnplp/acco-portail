import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyClient } from "@/lib/notify";
import { changeDoneNotification } from "@/lib/change-requests";

/**
 * Appelée par le worker Claude (Mac) après la mise en ligne d'une modification :
 * envoie au client la notification (fil + push + email selon ses réglages).
 * curl -X POST -H "Authorization: Bearer $CRON_SECRET" -d '{"id":"…"}' …/api/claude/en-ligne
 */
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const cr = id ? await prisma.changeRequest.findUnique({ where: { id }, include: { site: true } }) : null;
  if (!cr || !cr.claudeMergedAt || cr.claudeState !== "EN_LIGNE") return NextResponse.json({ error: "demande non publiée" }, { status: 404 });
  const n = changeDoneNotification(cr, cr.site);
  // Une seule notification par mise en ligne, même si le worker rappelle.
  const already = await prisma.notification.findFirst({ where: { clientId: n.clientId, kind: n.kind, href: n.href, createdAt: { gte: cr.claudeMergedAt } } });
  if (!already) await notifyClient(n);
  return NextResponse.json({ ok: true, deja: !!already });
}
