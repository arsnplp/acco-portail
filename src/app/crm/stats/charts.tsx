"use client";

import { useState } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type Bucket = { key: string; label: string; values: Record<string, number> };
type Serie = { key: string; label: string; color: string };

const nice = (max: number) => {
  if (max <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(max));
  const m = [1, 2, 4, 6, 8, 10].find((x) => x * p >= max)!; // pairs : la graduation du milieu tombe juste
  return m * p;
};

export function Panel({ title, subtitle, className, children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-card border border-border bg-surface p-4", className)}>
      <h2 className="text-base font-semibold text-title">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-text">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Chiffre clé + variation par rapport à la période précédente. */
export function KpiTile({ label, value, now, prev, color, sub, className }: { label: string; value: string; now?: number; prev?: number; color: string; sub?: string; className?: string }) {
  const diff = now !== undefined && prev !== undefined && prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
  return (
    <div className={cn("relative overflow-hidden rounded-card border border-border bg-surface p-4", className)}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} aria-hidden />
      <p className="text-xs font-medium text-text">{label}</p>
      <p className="mt-1.5 font-title text-3xl font-extrabold tabular-nums text-title">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {diff !== null && (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", diff >= 0 ? "text-green" : "text-pink")}>
            {diff >= 0 ? <ArrowUpRightIcon size={13} aria-hidden /> : <ArrowDownRightIcon size={13} aria-hidden />}
            {diff >= 0 ? "+" : ""}{diff} %
          </span>
        )}
        {sub && <span className="text-text">{sub}</span>}
        {diff !== null && !sub && <span className="text-muted">vs période d’avant</span>}
      </div>
    </div>
  );
}

function Legend({ series, hidden }: { series: Serie[]; hidden?: Set<string> }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-strong">
      {series.filter((s) => !hidden?.has(s.key)).map((s) => (
        <li key={s.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</li>
      ))}
    </ul>
  );
}

function Grid({ max }: { max: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[1, 0.5, 0].map((f) => (
        <div key={f} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${f * 100}%` }}>
          <span className="absolute -top-2 -left-8 w-6 text-right text-[10px] text-muted tabular-nums">{Math.round(max * f)}</span>
        </div>
      ))}
    </div>
  );
}

function Tooltip({ bucket, series, total }: { bucket: Bucket; series: Serie[]; total?: boolean }) {
  const rows = series.filter((s) => bucket.values[s.key]);
  const sum = rows.reduce((a, s) => a + (bucket.values[s.key] ?? 0), 0);
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max min-w-32 -translate-x-1/2 rounded-lg border border-border bg-bg px-3 py-2 text-xs shadow-xl shadow-black/50">
      <p className="mb-1 font-semibold text-title">{bucket.label}</p>
      {rows.length === 0 ? <p className="text-text">Rien</p> : rows.map((s) => (
        <p key={s.key} className="flex items-center justify-between gap-4 text-text-strong"><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: s.color }} />{s.label}</span><span className="tabular-nums">{bucket.values[s.key]}</span></p>
      ))}
      {total && rows.length > 1 && <p className="mt-1 flex justify-between border-t border-border pt-1 font-semibold text-title"><span>Total</span><span className="tabular-nums">{sum}</span></p>}
    </div>
  );
}

const labelEvery = (n: number) => (n > 20 ? Math.ceil(n / 8) : n > 12 ? 2 : 1);

/** Colonnes empilées (une couleur par type), avec info-bulle au survol. */
export function StackedBars({ buckets, series }: { buckets: Bucket[]; series: Serie[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = buckets.map((b) => series.reduce((a, s) => a + (b.values[s.key] ?? 0), 0));
  const max = nice(Math.max(1, ...totals));
  const every = labelEvery(buckets.length);
  return (
    <div>
      <Legend series={series} />
      <div className="relative ml-8 h-52">
        <Grid max={max} />
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {buckets.map((b, i) => (
            <div key={b.key} className="relative flex h-full flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className={cn("flex flex-col-reverse gap-[2px] transition-opacity", hover !== null && hover !== i && "opacity-40")} style={{ height: `${(totals[i] / max) * 100}%` }}>
                {series.map((s, k) => {
                  const v = b.values[s.key] ?? 0;
                  if (!v) return null;
                  const top = series.slice(k + 1).every((x) => !b.values[x.key]);
                  return <div key={s.key} style={{ flexGrow: v, flexBasis: 0, background: s.color, borderRadius: top ? "4px 4px 0 0" : 0, minHeight: 2 }} />;
                })}
              </div>
              {hover === i && <Tooltip bucket={b} series={series} total />}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-8 mt-1.5 flex gap-[3px]">
        {buckets.map((b, i) => <span key={b.key} className="flex-1 truncate text-center text-[10px] text-text">{i % every === 0 ? b.label : ""}</span>)}
      </div>
    </div>
  );
}

/** Colonnes côte à côte (RDV pris / no show). */
export function GroupedBars({ buckets, series }: { buckets: Bucket[]; series: Serie[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = nice(Math.max(1, ...buckets.flatMap((b) => series.map((s) => b.values[s.key] ?? 0))));
  const every = labelEvery(buckets.length);
  return (
    <div>
      <Legend series={series} />
      <div className="relative ml-8 h-44 lg:h-72">
        <Grid max={max} />
        <div className="absolute inset-0 flex items-end gap-1.5">
          {buckets.map((b, i) => (
            <div key={b.key} className={cn("relative flex h-full flex-1 items-end justify-center gap-[2px] transition-opacity", hover !== null && hover !== i && "opacity-40")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {series.map((s) => <div key={s.key} className="w-full max-w-5 rounded-t" style={{ height: `${((b.values[s.key] ?? 0) / max) * 100}%`, background: s.color, minHeight: b.values[s.key] ? 2 : 0 }} />)}
              {hover === i && <Tooltip bucket={b} series={series} />}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-8 mt-1.5 flex gap-1.5">
        {buckets.map((b, i) => <span key={b.key} className="flex-1 truncate text-center text-[10px] text-text">{i % every === 0 ? b.label : ""}</span>)}
      </div>
    </div>
  );
}

/** Barres horizontales, valeur au bout. */
export function HBars({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[96px_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate text-text-strong">{it.label}</span>
          <span className="h-3 rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color, minWidth: it.value ? 6 : 0 }} /></span>
          <span className="w-8 text-right tabular-nums text-title">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Anneau du pipeline, total au centre, légende avec les valeurs. */
export function Donut({ items, center }: { items: { label: string; value: number; color: string; montant?: string | null }[]; center?: { value: string; label: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((a, i) => a + i.value, 0);
  const R = 70, C = 2 * Math.PI * R, gap = total ? 2 : 0;
  const lens = items.map((it) => (total ? (it.value / total) * C : 0));
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  const shown = hover !== null ? items[hover] : null;
  // Au centre : le total (ou le montant du statut survolé), sinon le nombre de prospects.
  const big = (shown ? (center && shown.montant ? shown.montant : String(shown.value)) : center ? center.value : String(total)).replace(/\u202f/g, "\u00a0");
  const small = shown ? (center && shown.montant ? `${shown.label} · ${shown.value}` : shown.label) : center ? center.label : "prospects";
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col">
      <svg viewBox="0 0 180 180" className="size-44 shrink-0" role="img" aria-label={`Pipeline : ${center ? `${center.value} de ${center.label}, ` : ""}${total} prospects`}>
        <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="22" />
        {items.map((it, i) => {
          const len = lens[i];
          return !it.value ? null : <circle key={it.label} cx="90" cy="90" r={R} fill="none" stroke={it.color} strokeWidth={hover === i ? 26 : 22}
            strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 90 90)"
            className="cursor-pointer transition-all" opacity={hover !== null && hover !== i ? 0.35 : 1}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
        })}
        <text x="90" y="88" textAnchor="middle" className="fill-[var(--title)] font-title" fontSize={big.length > 7 ? 20 : big.length > 5 ? 24 : 30} fontWeight="800">{big}</text>
        <text x="90" y="108" textAnchor="middle" className="fill-[var(--text)]" fontSize="11">{small}</text>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cn("flex items-center gap-2 rounded px-1 transition-opacity", hover !== null && hover !== i && "opacity-40")}>
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: it.color }} />
            <span className="flex-1 truncate text-text-strong">{it.label}</span>
            {center ? <>
              <span className="tabular-nums text-title">{it.montant ?? ""}</span>
              <span className="w-9 text-right text-xs tabular-nums text-muted">{it.value}</span>
            </> : <>
              <span className="tabular-nums text-title">{it.value}</span>
              <span className="w-9 text-right text-xs tabular-nums text-muted">{total ? Math.round((it.value / total) * 100) : 0} %</span>
            </>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Entonnoir : chaque étape aussi large que sa valeur, le taux de passage entre deux. */
export function Funnel({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const first = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label} className="rounded-card border border-border bg-surface-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-text">{s.label}</span>
              {i > 0 && <span className="text-xs font-semibold text-text-strong">{rate === null ? "–" : `${rate} %`}</span>}
            </div>
            <p className="mt-1 font-title text-2xl font-extrabold tabular-nums text-title">{s.value}</p>
            <span className="mt-2 block h-2 rounded-full bg-bg"><span className="block h-full rounded-full" style={{ width: `${(s.value / first) * 100}%`, background: s.color, minWidth: s.value ? 6 : 0 }} /></span>
          </li>
        );
      })}
    </ol>
  );
}
