import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@prisma/client";
import { sendEmail, layout, appUrl } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { isGestionnaire } from "@/lib/roles";

type Pref = "contactRequests" | "reviews" | "changes" | "recaps" | "messages" | "offers" | "documents";

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
  emailText?: string;
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
        text: opts.emailText,
        html: opts.emailHtml ?? layout(opts.title, `<p>${opts.body ?? ""}</p>`, opts.href ? { label: "Ouvrir mon espace", href: appUrl(opts.href) } : undefined),
      });
    }),
  );
}

type AdminPref = "changes" | "messages" | "referrals" | "documents" | "offers"; // offers : nouvelle commande d’un client

/**
 * Push au gestionnaire du Suivi client (Arsène) selon ses réglages (Paramètres → Mes notifications).
 * Ne lève jamais d'erreur : une notification ratée ne doit pas casser l'action du client.
 */
export async function notifyAdmins(opts: { title: string; body?: string; href: string; pref: AdminPref; tag?: string }) {
  try {
    // Partie Suivi client : seul le gestionnaire (Arsène) est prévenu, pas l'équipe commerciale.
    const admins = (await prisma.user.findMany({ where: { role: "ADMIN" }, include: { notificationPref: true } })).filter(isGestionnaire);
    await Promise.all(
      admins.map(async (u) => {
        const p = u.notificationPref;
        if (p && (!p.pushEnabled || !p[opts.pref])) return;
        await sendPushToUser(u.id, { title: opts.title, body: opts.body, url: appUrl(opts.href), tag: opts.tag ?? opts.pref });
      }),
    );
  } catch (e) {
    console.warn("[notifyAdmins]", (e as Error).message);
  }
}

/** Texte court pour le corps d'une notification. */
export const excerpt = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
