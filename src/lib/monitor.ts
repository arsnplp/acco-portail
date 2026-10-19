import tls from "node:tls";
import { prisma } from "@/lib/prisma";
import { sendEmail, layout, appUrl } from "@/lib/email";

const TIMEOUT_MS = 10_000;

/** Date d'expiration du certificat TLS d'un hôte (null si injoignable). */
export function sslExpiry(hostname: string): Promise<Date | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, timeout: TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert?.valid_to ? new Date(cert.valid_to) : null);
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => { socket.destroy(); resolve(null); });
  });
}

/** Vérifie un site : réponse HTTP, temps de réponse, SSL. Enregistre le résultat. */
export async function checkSite(site: { id: string; name: string; url: string }) {
  const started = Date.now();
  let isUp = false, statusCode: number | null = null;
  try {
    const res = await fetch(site.url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "AccoMonitor/1.0 (+https://acco-lab.fr)" }, cache: "no-store" });
    statusCode = res.status;
    isUp = res.status < 500;
  } catch {
    isUp = false;
  }
  const responseMs = Date.now() - started;
  const host = new URL(site.url).hostname;
  const sslExpiresAt = site.url.startsWith("https://") ? await sslExpiry(host) : null;
  return prisma.siteHealthCheck.create({ data: { siteId: site.id, isUp, statusCode, responseMs, sslExpiresAt } });
}

async function alertTeam(subject: string, html: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  await Promise.all(admins.map((a) => sendEmail({ to: a.email, subject, html })));
}

/** Tous les sites en ligne. Alerte l'équipe à la 2e panne consécutive, au retour, et quand le SSL expire sous 14 jours (1 fois par jour). */
export async function runMonitoring() {
  const sites = await prisma.site.findMany({ where: { status: "EN_LIGNE", url: { not: null } }, select: { id: true, name: true, url: true, clientId: true } });
  const results: { site: string; up: boolean; ms: number; ssl: string | null }[] = [];
  for (const s of sites) {
    const previous = await prisma.siteHealthCheck.findMany({ where: { siteId: s.id }, orderBy: { checkedAt: "desc" }, take: 2 });
    const check = await checkSite({ id: s.id, name: s.name, url: s.url! });
    results.push({ site: s.name, up: check.isUp, ms: check.responseMs ?? 0, ssl: check.sslExpiresAt?.toISOString().slice(0, 10) ?? null });

    const wasDown = previous[0] && !previous[0].isUp;
    const link = { label: "Ouvrir la fiche du site", href: appUrl(`/admin/sites/${s.id}`) };
    if (!check.isUp && wasDown && previous[1]?.isUp) {
      await alertTeam(`⚠️ ${s.name} ne répond plus`, layout(`${s.name} ne répond plus`, `<p>Deux vérifications consécutives ont échoué (${check.statusCode ?? "pas de réponse"}).</p><p>URL : <a href="${s.url}">${s.url}</a></p>`, link));
    } else if (check.isUp && wasDown && previous[1] && !previous[1].isUp) {
      await alertTeam(`✅ ${s.name} est de retour`, layout(`${s.name} répond à nouveau`, `<p>Temps de réponse : ${check.responseMs} ms.</p>`, link));
    }
    if (check.sslExpiresAt) {
      const days = Math.floor((check.sslExpiresAt.getTime() - Date.now()) / 86400_000);
      const alreadyToday = previous[0]?.sslExpiresAt && previous[0].checkedAt.toDateString() === new Date().toDateString() && (previous[0].sslExpiresAt.getTime() - previous[0].checkedAt.getTime()) / 86400_000 < 14;
      if (days < 14 && !alreadyToday) {
        await alertTeam(`🔒 Certificat SSL de ${s.name} : ${days} jour${days > 1 ? "s" : ""}`, layout(`Le certificat de ${s.name} expire dans ${days} jour${days > 1 ? "s" : ""}`, `<p>Renouvelez-le (certbot) avant le ${check.sslExpiresAt.toLocaleDateString("fr-FR")}.</p>`, link));
      }
    }
  }
  // On garde 30 jours d'historique.
  await prisma.siteHealthCheck.deleteMany({ where: { checkedAt: { lt: new Date(Date.now() - 30 * 86400_000) } } });
  return results;
}
