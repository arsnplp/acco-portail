import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@prisma/client";
import { sendEmail, layout, appUrl } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

type Pref = "contactRequests" | "reviews" | "changes" | "recaps" | "messages" | "offers";

/**
 * Crée une notification dans le fil du client, puis envoie le push et l'email
 * aux membres selon leurs préférences (email en secours du push).
 */
export async function notifyClient(opts: {
  clientId: string;
  siteId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  pref: Pref;
  emailHtml?: string;
  emailSubject?: string;
}) {
  await prisma.notification.create({
    data: { clientId: opts.clientId, siteId: opts.siteId ?? null, kind: opts.kind, title: opts.title, body: opts.body, href: opts.href },
  });
  const members = await prisma.clientMembership.findMany({ where: { clientId: opts.clientId }, include: { user: { include: { notificationPref: true } } } });
  await Promise.all(
    members.map(async ({ user }) => {
      const p = user.notificationPref;
      if (p && !p[opts.pref]) return;
      if (!p || p.pushEnabled) await sendPushToUser(user.id, { title: opts.title, body: opts.body, url: opts.href ? appUrl(opts.href) : appUrl("/"), tag: opts.kind });
      if (p && !p.emailEnabled) return;
      await sendEmail({
        to: user.email,
        subject: opts.emailSubject ?? opts.title,
        html: opts.emailHtml ?? layout(opts.title, `<p>${opts.body ?? ""}</p>`, opts.href ? { label: "Ouvrir mon espace", href: appUrl(opts.href) } : undefined),
      });
    }),
  );
}
