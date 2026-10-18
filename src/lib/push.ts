import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function setup() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:contact@acco-lab.fr", pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

/** Envoie une notification push à tous les appareils d'un utilisateur. Supprime les abonnements expirés. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!setup()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86400 });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.warn("[push]", status, (e as Error).message);
      }
    }),
  );
}
