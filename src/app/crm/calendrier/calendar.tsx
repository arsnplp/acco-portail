"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export type Vue = "jour" | "semaine" | "mois";
export type CalEvent = {
  id: string; kind: "rdv" | "rappel"; at: string; duree: number; prospectId: string; nom: string; societe: string;
  objet: string; resultat: "PREVU" | "FAIT" | "NO_SHOW" | "ANNULE" | null; qui: string | null;
};

const TZ = "Europe/Paris";
const H0 = 7, H1 = 21, PX = 52; // heures affichées et hauteur d'une heure
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const minutesOf = (iso: string) => { const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).split(":").map(Number); return h * 60 + m; };
const hhmm = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const label = (day: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...o }).format(new Date(`${day}T12:00:00Z`));

function style(e: CalEvent) {
  if (e.kind === "rappel") return "border border-dashed border-blue/70 bg-blue/10 text-text-strong";
  if (e.resultat === "FAIT") return "border-l-4 border-green bg-green/15 text-text-strong";
  if (e.resultat === "NO_SHOW") return "border-l-4 border-pink bg-pink/15 text-text-strong";
  if (e.resultat === "ANNULE") return "border-l-4 border-muted bg-surface-2 text-text line-through";
  return "border-l-4 border-claude bg-claude/15 text-text-strong";
}

/** Place les événements qui se chevauchent côte à côte (colonnes). */
function lanes(evts: CalEvent[]) {
  const out: { e: CalEvent; lane: number; lanes: number }[] = [];
  let group: typeof out = [], groupEnd = -1;
  const flush = () => { const n = Math.max(1, ...group.map((g) => g.lane + 1)); group.forEach((g) => (g.lanes = n)); out.push(...group); group = []; };
  for (const e of evts) {
    const s = minutesOf(e.at), f = s + Math.max(20, e.duree);
    if (s >= groupEnd) { flush(); groupEnd = -1; }
    const used = new Set(group.filter((g) => minutesOf(g.e.at) + Math.max(20, g.e.duree) > s).map((g) => g.lane));
    let lane = 0; while (used.has(lane)) lane++;
    group.push({ e, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, f);
  }
  flush();
  return out;
}

function EventBox({ e, compact }: { e: CalEvent; compact?: boolean }) {
  return (
    <Link href={`/crm/prospects/${e.prospectId}`} title={`${hhmm(e.at)} · ${e.nom} · ${e.objet}`} className={cn("block h-full overflow-hidden rounded-md text-xs leading-tight hover:brightness-125", compact ? "px-1 py-0.5" : "px-2 py-1", style(e))}>
      {compact ? (
        <>
          <span className="block truncate"><span className="font-semibold text-title">{e.nom}</span> <span className="text-[10px] tabular-nums">{hhmm(e.at)}</span></span>
          <span className="block truncate text-[10px] text-text">{e.objet}</span>
        </>
      ) : (
        <><span className="font-semibold tabular-nums">{hhmm(e.at)}</span> <span className="font-semibold text-title">{e.nom}</span></>
      )}
      {!compact && <span className="block truncate text-[11px] text-text">{e.objet}{e.nom !== e.societe ? ` · ${e.societe}` : ""}{e.qui ? ` · ${e.qui}` : ""}</span>}
    </Link>
  );
}

/** Grille horaire (vue jour, et semaine sur ordinateur). */
function TimeGrid({ days, events, today }: { days: string[]; events: CalEvent[]; today: string }) {
  const hours = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);
  const now = new Date().toISOString();
  const nowMin = minutesOf(now);
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className={cn("border-l border-border px-2 py-2 text-center text-xs capitalize", d === today ? "font-semibold text-title" : "text-text")}>
            {label(d, { weekday: days.length > 1 ? "short" : "long", day: "numeric", month: days.length > 1 ? undefined : "long" })}
            {d === today && <span className="ml-1 inline-block size-1.5 rounded-full bg-yellow align-middle" />}
          </div>
        ))}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div>{hours.map((h) => <div key={h} className="relative text-right text-[10px] text-muted" style={{ height: PX }}><span className="absolute -top-1.5 right-2">{h}:00</span></div>)}</div>
        {days.map((d) => {
          const list = events.filter((e) => dayOf(e.at) === d);
          const avant = list.filter((e) => minutesOf(e.at) < H0 * 60), apres = list.filter((e) => minutesOf(e.at) > H1 * 60);
          return (
            <div key={d} className="relative border-l border-border" style={{ height: hours.length * PX }}>
              {hours.map((h) => <div key={h} className="border-t border-border/60" style={{ height: PX }} />)}
              {d === today && nowMin >= H0 * 60 && nowMin <= H1 * 60 && <div className="absolute inset-x-0 z-10 border-t-2 border-yellow" style={{ top: ((nowMin - H0 * 60) / 60) * PX }} aria-label="Maintenant" />}
              {lanes(list.filter((e) => !avant.includes(e) && !apres.includes(e))).map(({ e, lane, lanes: n }) => {
                const top = ((minutesOf(e.at) - H0 * 60) / 60) * PX;
                const h = Math.max(24, (Math.max(20, e.duree) / 60) * PX - 2);
                return <div key={e.id} className="absolute z-20 p-px" style={{ top, height: h, left: `${(lane / n) * 100}%`, width: `${100 / n}%` }}><EventBox e={e} compact={h < 40 || n > 2} /></div>;
              })}
              {(avant.length > 0 || apres.length > 0) && <p className="absolute top-0 right-1 z-20 rounded bg-surface-2 px-1 text-[10px] text-text">{avant.length + apres.length} hors 7 h–21 h</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Liste par jour (semaine sur téléphone). */
function Agenda({ days, events, today }: { days: string[]; events: CalEvent[]; today: string }) {
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const list = events.filter((e) => dayOf(e.at) === d);
        return (
          <section key={d}>
            <h3 className={cn("mb-1.5 text-sm capitalize", d === today ? "font-semibold text-title" : "text-text")}>{label(d, { weekday: "long", day: "numeric", month: "long" })}{d === today ? " · aujourd’hui" : ""}</h3>
            {list.length === 0 ? <p className="text-xs text-muted">Rien de prévu</p> : <div className="space-y-1.5">{list.map((e) => <div key={e.id} className="h-auto"><EventBox e={e} /></div>)}</div>}
          </section>
        );
      })}
    </div>
  );
}

function MonthGrid({ first, events, today, month, base }: { first: string; events: CalEvent[]; today: string; month: string; base: string }) {
  const days = Array.from({ length: 42 }, (_, i) => shift(first, i));
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] text-text">
        {["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((j) => <div key={j} className="py-2">{j}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = events.filter((e) => dayOf(e.at) === d);
          const out = d.slice(0, 7) !== month;
          return (
            <div key={d} className={cn("min-h-24 border-border p-1 sm:min-h-28 sm:p-1.5", i % 7 !== 0 && "border-l", i >= 7 && "border-t", out && "bg-bg/40")}>
              <Link href={`${base}&vue=jour&d=${d}`} className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs", d === today ? "bg-yellow font-bold text-bg" : out ? "text-muted" : "text-text-strong hover:bg-surface-2")}>{Number(d.slice(8))}</Link>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((e) => (
                  <Link key={e.id} href={`/crm/prospects/${e.prospectId}`} title={`${hhmm(e.at)} · ${e.nom} · ${e.objet}`} className={cn("block truncate rounded px-1 py-0.5 text-[10px] leading-tight sm:text-[11px]", style(e))}>
                    <span className="tabular-nums">{hhmm(e.at)}</span> <span className="hidden sm:inline">{e.nom}</span>
                  </Link>
                ))}
                {list.length > 3 && <Link href={`${base}&vue=jour&d=${d}`} className="block px-1 text-[10px] font-semibold text-text hover:text-title">+{list.length - 3} autre{list.length - 3 > 1 ? "s" : ""}</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Calendar({ vue, first, days, today, month, events, base }: { vue: Vue; first: string; days: number; today: string; month: string; events: CalEvent[]; base: string }) {
  const list = Array.from({ length: days }, (_, i) => shift(first, i));
  if (vue === "mois") return <MonthGrid first={first} events={events} today={today} month={month} base={base} />;
  if (vue === "jour") {
    return (
      <>
        <TimeGrid days={list} events={events} today={today} />
        {events.length === 0 && <p className="mt-3 text-sm text-text">Aucun rendez-vous ni rappel ce jour-là.</p>}
      </>
    );
  }
  return (
    <>
      <div className="hidden md:block"><TimeGrid days={list} events={events} today={today} /></div>
      <div className="md:hidden"><Agenda days={list} events={events} today={today} /></div>
    </>
  );
}
