/**
 * Périodes calendaires des statistiques de Prospection (demande du 16/11) : semaine en cours (lundi → dimanche), mois en cours,
 * 3 derniers mois et 12 derniers mois calendaires, mois en cours inclus. Jamais de jours glissants : en novembre,
 * « 3 derniers mois » = septembre, octobre et novembre. Bornes à minuit heure de Paris ; la période précédente (comparaison)
 * est la même durée calendaire juste avant.
 */
import { parisDay, parisMidnight } from "@/lib/crm";

export type PeriodeKey = "semaine" | "mois" | "3mois" | "12mois";
export const PERIODES_STATS: { key: PeriodeKey; label: string }[] = [
  { key: "semaine", label: "Semaine en cours" }, { key: "mois", label: "Mois en cours" }, { key: "3mois", label: "3 derniers mois" }, { key: "12mois", label: "12 derniers mois" },
];
export const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const ymd = (y: number, m: number, d: number) => { const dt = new Date(Date.UTC(y, m, d, 12)); return dt.toISOString().slice(0, 10); };
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const premierDuMois = (y: number, m: number) => ymd(y, m, 1);

export type Bucket = { key: string; label: string; start: number };
export type Periode = { key: PeriodeKey; label: string; debut: Date; fin: Date; prevDebut: Date; unit: "jour" | "semaine" | "mois"; buckets: Bucket[] };

export function periodeStats(key: PeriodeKey, now = new Date()): Periode {
  const today = parisDay(now);
  const [y, m, d] = today.split("-").map(Number);
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
  let debutDay: string, finDay: string, prevDay: string, unit: Periode["unit"];
  if (key === "semaine") { debutDay = shift(today, -dow); finDay = shift(debutDay, 7); prevDay = shift(debutDay, -7); unit = "jour"; }
  else if (key === "mois") { debutDay = premierDuMois(y, m - 1); finDay = premierDuMois(y, m); prevDay = premierDuMois(y, m - 2); unit = "jour"; }
  else if (key === "3mois") { debutDay = premierDuMois(y, m - 3); finDay = premierDuMois(y, m); prevDay = premierDuMois(y, m - 6); unit = "semaine"; }
  else { debutDay = premierDuMois(y, m - 12); finDay = premierDuMois(y, m); prevDay = premierDuMois(y, m - 24); unit = "mois"; }
  void d;
  const debut = parisMidnight(debutDay), fin = parisMidnight(finDay), prevDebut = parisMidnight(prevDay);

  const buckets: Bucket[] = [];
  if (unit === "mois") {
    for (let day = debutDay; day < finDay; day = premierDuMois(Number(day.slice(0, 4)), Number(day.slice(5, 7)))) {
      buckets.push({ key: day.slice(0, 7), label: MOIS_COURT[Number(day.slice(5, 7)) - 1], start: parisMidnight(day).getTime() });
    }
  } else if (unit === "semaine") {
    // Semaines du lundi au dimanche, la première commençant au plus tard le 1er du premier mois.
    const dowDebut = (new Date(`${debutDay}T12:00:00Z`).getUTCDay() + 6) % 7;
    for (let day = shift(debutDay, -dowDebut); day < finDay; day = shift(day, 7)) {
      const [, mm, dd] = day.split("-").map(Number);
      buckets.push({ key: day, label: `${dd} ${MOIS_COURT[mm - 1]}`, start: Math.max(parisMidnight(day).getTime(), debut.getTime()) });
    }
  } else {
    for (let day = debutDay; day < finDay; day = shift(day, 1)) {
      const [, , dd] = day.split("-").map(Number);
      buckets.push({ key: day, label: key === "semaine" ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)) : String(dd), start: parisMidnight(day).getTime() });
    }
  }
  const f = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const labelPeriode = key === "semaine" ? `du ${f.format(new Date(`${debutDay}T12:00:00Z`))} au ${f.format(new Date(`${shift(finDay, -1)}T12:00:00Z`))}`
    : key === "mois" ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${debutDay}T12:00:00Z`))
    : `de ${MOIS_COURT[Number(debutDay.slice(5, 7)) - 1]} à ${MOIS_COURT[m - 1]} ${y}`;
  return { key, label: labelPeriode, debut, fin, prevDebut, unit, buckets };
}
