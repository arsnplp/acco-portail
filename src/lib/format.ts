export const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));

export const fmtDateShort = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(d));

export const fmtPrice = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export function timeAgo(d: Date | string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "à l’instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return fmtDateShort(d);
}

export const addDays = (n: number, from = new Date()) => new Date(from.getTime() + n * 86400_000);

/** Numéro de semaine absolu (pour alterner un contenu une semaine sur deux). */
export const weekIndex = (d = new Date()) => Math.floor(d.getTime() / (7 * 86400_000));
