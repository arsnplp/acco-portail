import type { EchangeType, ProspectSource, ProspectStatut } from "@prisma/client";
import type { Tone } from "@/components/ui/badge";

/** Les 5 colonnes du pipeline, dans l'ordre du tunnel. */
export const PIPELINE: ProspectStatut[] = ["A_CONTACTER", "A_RELANCER", "POSER_RDV", "RDV_POSE", "A_SIGNER"];

export const STATUT: Record<ProspectStatut, { label: string; tone: Tone }> = {
  A_CONTACTER: { label: "À contacter", tone: "blue" },
  A_RELANCER: { label: "À relancer", tone: "neutral" },
  POSER_RDV: { label: "Poser RDV", tone: "yellow" },
  RDV_POSE: { label: "RDV posé", tone: "claude" },
  A_SIGNER: { label: "À signer", tone: "pink" },
  GAGNE: { label: "Gagné", tone: "green" },
  PERDU: { label: "Perdu", tone: "neutral" },
};

export const ECHANGE: Record<EchangeType, { label: string; short: string }> = {
  NRP: { label: "NRP (ne répond pas)", short: "NRP" },
  APPEL: { label: "Appel", short: "Appel" },
  MAIL: { label: "Mail", short: "Mail" },
  PP: { label: "Prospection physique", short: "PP" },
  PRISE_RDV: { label: "Prise de RDV", short: "Prise de RDV" },
  RDV: { label: "RDV honoré", short: "RDV" },
  NO_SHOW: { label: "No show (pas venu au RDV)", short: "No show" },
  NOTE: { label: "Note", short: "Note" },
};
export const ECHANGE_SAISIE: EchangeType[] = ["NRP", "APPEL", "MAIL", "PP", "PRISE_RDV", "RDV"];

export const SOURCE: Record<ProspectSource, string> = {
  COLD_CALL: "Cold call",
  PROSPECTION_PHYSIQUE: "Prospection physique",
  RECOMMANDATION: "Recommandation",
  SITE_WEB: "Site web",
  AUTRE: "Autre",
};

/** Couleurs des graphiques (palette validée pour le fond sombre : daltonisme et contraste). Toujours accompagnées d'un libellé. */
export const VIZ = {
  blue: "#3987e5", orange: "#d95926", aqua: "#199e70", yellow: "#c98500", magenta: "#d55181", green: "#008300", violet: "#9085e9", red: "#e66767",
} as const;
export const ECHANGE_COULEUR: Record<EchangeType, string> = {
  NRP: VIZ.violet, APPEL: VIZ.blue, MAIL: VIZ.aqua, PP: VIZ.yellow, PRISE_RDV: VIZ.orange, RDV: VIZ.green, NO_SHOW: VIZ.red, NOTE: "#7a7d85",
};
export const STATUT_COULEUR: Record<ProspectStatut, string> = {
  A_CONTACTER: VIZ.blue, A_RELANCER: VIZ.violet, POSER_RDV: VIZ.yellow, RDV_POSE: VIZ.orange, A_SIGNER: VIZ.magenta, GAGNE: VIZ.aqua, PERDU: "#4b4e55",
};

export const MOTIFS_PERTE = ["Pas intéressé", "A déjà un site", "Trop cher", "Injoignable", "Pas le bon moment", "Autre"];

/**
 * Ce que propose « Noter un échange » selon le type : nouveau statut (null = inchangé) et relance dans N jours.
 * Le commercial peut toujours modifier avant d'enregistrer.
 */
export const REGLES: Record<EchangeType, { statut: ProspectStatut | null; relanceJours: number | null }> = {
  NRP: { statut: "A_RELANCER", relanceJours: 2 },
  APPEL: { statut: null, relanceJours: 7 },
  MAIL: { statut: null, relanceJours: 3 },
  PP: { statut: null, relanceJours: 7 },
  PRISE_RDV: { statut: "RDV_POSE", relanceJours: null }, // relance = jour du RDV
  RDV: { statut: "A_SIGNER", relanceJours: 2 },
  NO_SHOW: { statut: "POSER_RDV", relanceJours: 1 }, // on recale un RDV dès demain
  NOTE: { statut: null, relanceJours: null },
};

/** Statut proposé après un échange : on ne fait jamais reculer un prospect déjà avancé sur un simple NRP, appel ou mail. */
export function statutApres(type: EchangeType, current: ProspectStatut): ProspectStatut {
  const proposed = REGLES[type].statut;
  if (!proposed) return current;
  if (type === "NRP") return current === "A_CONTACTER" ? "A_RELANCER" : current;
  return proposed;
}

// ─── Dates au fuseau de Paris (le serveur tourne en UTC) ─────
const TZ = "Europe/Paris";
function parisOffsetMs(at: number) {
  const d = new Date(at);
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return local.getTime() - utc.getTime();
}
/** « 2026-10-25 » du jour à Paris. */
export const parisDay = (d: Date = new Date()) => d.toLocaleDateString("en-CA", { timeZone: TZ });
/** Minuit (heure de Paris) du jour « YYYY-MM-DD », en Date UTC. */
export function parisMidnight(day: string) {
  const [y, m, dd] = day.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, dd);
  return new Date(utc - parisOffsetMs(utc));
}
/** Date + heure locale (« 2026-10-25 », « 14:30 ») → Date UTC. */
export function parisDateTime(day: string, time: string) {
  const [h, mi] = time.split(":").map(Number);
  return new Date(parisMidnight(day).getTime() + (h * 60 + (mi || 0)) * 60_000);
}
export function todayBounds(now = new Date()) {
  const start = parisMidnight(parisDay(now));
  return { start, end: new Date(start.getTime() + 86400_000) };
}
export const addDaysParis = (n: number, from = new Date()) => parisMidnight(parisDay(new Date(from.getTime() + n * 86400_000)));

export const fmtDay = (d: Date | string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(d));
export const fmtDayTime = (d: Date | string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
export const fmtTime = (d: Date | string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(d));

/** Relance : libellé court + état (retard, aujourd'hui, à venir). */
export function relanceInfo(d: Date | string | null) {
  if (!d) return { label: "Pas de relance", state: "none" as const };
  const { start, end } = todayBounds();
  const t = new Date(d);
  if (t < start) {
    const days = Math.max(1, Math.round((start.getTime() - parisMidnight(parisDay(t)).getTime()) / 86400_000));
    return { label: days === 1 ? "Hier" : `En retard de ${days} j`, state: "late" as const };
  }
  if (t < end) return { label: "Aujourd'hui", state: "today" as const };
  if (t < new Date(end.getTime() + 86400_000)) return { label: "Demain", state: "soon" as const };
  return { label: fmtDay(t), state: "later" as const };
}

// ─── Affichage ───────────────────────────────────────────────
export function contactName(c?: { prenom: string | null; nom: string | null } | null) {
  if (!c) return null;
  const s = [c.prenom, c.nom ? c.nom.charAt(0) + c.nom.slice(1).toLowerCase() : null].filter(Boolean).join(" ").trim();
  return s || null;
}
export const initialsOf = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

/** Icône du site (service Google, gratuit et sans clé). Clearbit a fermé son API de logos en 2025. */
export function logoUrl(siteWeb: string | null) {
  if (!siteWeb) return null;
  try {
    const host = new URL(/^https?:\/\//.test(siteWeb) ? siteWeb : `https://${siteWeb}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    return null;
  }
}

// ─── Doublons ────────────────────────────────────────────────
export const normPhone = (s: string | null | undefined) => {
  const d = (s ?? "").replace(/[^\d+]/g, "").replace(/^\+33/, "0").replace(/^0033/, "0");
  return d.length >= 9 ? d : null;
};
export const normName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
export function hostOf(url: string | null | undefined) {
  if (!url) return null;
  try { return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

/** Libellé d'un membre de l'équipe. */
export const teamName = (u: { firstName: string | null; lastName?: string | null; email: string }) => u.firstName || u.email.split("@")[0];
