import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Purge RGPD, une fois par jour : demandes de contact de plus de 24 mois,
 * notifications de plus de 12 mois, invitations expirées, jetons push orphelins.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const now = Date.now();
  const [contacts, notifications, invitations] = await Promise.all([
    prisma.contactRequest.deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 30.44 * 86400_000) } } }),
    prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(now - 365 * 86400_000) } } }),
    prisma.invitation.deleteMany({ where: { expiresAt: { lt: new Date(now - 30 * 86400_000) }, acceptedAt: null } }),
  ]);
  return NextResponse.json({ contactsSupprimes: contacts.count, notificationsSupprimees: notifications.count, invitationsSupprimees: invitations.count });
}
