import { prisma } from "@/lib/prisma";

/** Journalise une connexion (affichée sur la fiche client : qui se connecte, quand). Purge après 6 mois par le cron rgpd. */
export async function recordLogin(userId: string, userAgent: string | null) {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { memberships: { take: 1, orderBy: { createdAt: "asc" }, select: { clientId: true } } } });
    await prisma.loginLog.create({ data: { userId, clientId: u?.memberships[0]?.clientId ?? null, userAgent: userAgent?.slice(0, 200) ?? null } });
  } catch (e) {
    console.warn("[login-log]", (e as Error).message);
  }
}

/** « iPhone · Safari », « Mac · Chrome »… à partir du user agent. */
export function appareil(ua: string | null) {
  if (!ua) return "Appareil inconnu";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Appareil";
  const nav = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navigateur";
  return `${os} · ${nav}`;
}
