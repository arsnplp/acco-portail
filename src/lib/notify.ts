import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@prisma/client";
import { sendEmail, layout, appUrl } from "@/lib/email";

type Pref = "contactRequests" | "reviews" | "changes" | "recaps" | "messages" | "offers";

/**
 * Crée une notification dans le fil du client et envoie l'email aux membres
 * qui ont gardé l'email actif pour ce type. (Le push arrive à l'étape 5.)
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
      if (p && (!p.emailEnabled || !p[opts.pref])) return;
      await sendEmail({
        to: user.email,
        subject: opts.emailSubject ?? opts.title,
        html: opts.emailHtml ?? layout(opts.title, `<p>${opts.body ?? ""}</p>`, opts.href ? { label: "Ouvrir mon espace", href: appUrl(opts.href) } : undefined),
      });
    }),
  );
}
