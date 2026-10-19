import { BarChart3, Search } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LineChart } from "@/components/charts/line-chart";
import { MONTHS, monthLabel, previousMonth } from "@/lib/recaps";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Résultats" };

export default async function ResultatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const [stats, recaps] = await Promise.all([
    prisma.searchStatsMonthly.findMany({ where: { siteId: site.id }, orderBy: [{ year: "desc" }, { month: "desc" }], take: 13 }),
    prisma.monthlyRecap.findMany({ where: { siteId: site.id }, orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 }),
  ]);

  if (stats.length === 0) {
    return <Empty icon={BarChart3} title="Vos résultats arrivent" text="Dès que Google aura un mois complet de données sur votre site, vous verrez ici vos visites et les recherches qui vous amènent des clients." />;
  }

  const [cur, prev] = stats;
  const target = previousMonth();
  const isLatest = cur.year === target.year && cur.month === target.month;
  const serie = [...stats].slice(0, 12).reverse();
  const top = ((cur.topQueries as { query: string; clicks: number; position: number }[]) ?? []).slice(0, 5);

  return (
    <div>
      <p className="mb-3 text-sm text-text">
        {MONTHS[cur.month - 1][0].toUpperCase() + MONTHS[cur.month - 1].slice(1)} {cur.year}{isLatest ? "" : " (dernier mois disponible)"}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Stat value={cur.clicks} prev={prev?.clicks} label="visites depuis Google" />
        <Stat value={cur.impressions} prev={prev?.impressions} label="apparitions dans Google" compact />
        <Stat value={cur.position} prev={prev?.position} label="position moyenne" lowerIsBetter decimals={1} />
      </div>

      <SectionTitle emoji="📈">Visites sur 12 mois</SectionTitle>
      <Card>
        <LineChart points={serie.map((s) => s.clicks)} labels={serie.map((s) => MONTHS[s.month - 1].slice(0, 3))} />
      </Card>

      <SectionTitle emoji="🔎">Ce que les gens tapent pour vous trouver</SectionTitle>
      {top.length === 0 ? <Empty icon={Search} title="Pas encore assez de données" /> : (
        <Card className="divide-y divide-border p-0">
          {top.map((q, i) => (
            <div key={q.query} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 text-sm text-muted">{i + 1}</span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-title">{q.query}</p>
              <span className="shrink-0 text-xs text-text">position {q.position}</span>
            </div>
          ))}
        </Card>
      )}

      {recaps.length > 0 && (
        <>
          <SectionTitle emoji="🗓️">Vos récaps mensuels</SectionTitle>
          <MoreList title="Récaps mensuels" limit={3} items={recaps.map((r) => (
              <details key={r.id} className="rounded-card border border-border bg-surface" open={r.id === recaps[0].id}>
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                  <span className="font-medium text-title">{monthLabel(r.year, r.month)[0].toUpperCase() + monthLabel(r.year, r.month).slice(1)}</span>
                  <span className="text-xs text-text">{r.clicks} visites · {r.contactCount} demande{r.contactCount > 1 ? "s" : ""}</span>
                </summary>
                <div className="border-t border-border px-4 py-3">
                  <p className="text-sm leading-relaxed text-text-strong">{r.summary}</p>
                  {r.sentAt && <p className="mt-2 text-xs text-muted">Envoyé le {fmtDate(r.sentAt)}</p>}
                </div>
              </details>
            ))} />
        </>
      )}
    </div>
  );
}

function Stat({ value, prev, label, lowerIsBetter = false, decimals = 0, compact = false }: { value: number; prev?: number; label: string; lowerIsBetter?: boolean; decimals?: number; compact?: boolean }) {
  const delta = prev === undefined || prev === 0 ? null : lowerIsBetter ? Math.round((prev - value) * 10) / 10 : Math.round(((value - prev) / prev) * 100);
  const good = delta !== null && delta > 0, bad = delta !== null && delta < 0;
  const shown = compact && value >= 10000 ? `${Math.round(value / 1000)} k` : value.toLocaleString("fr-FR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
  return (
    <Card className="px-3 py-3">
      <p className="font-title text-2xl font-extrabold leading-none text-title">{shown}</p>
      <p className="mt-1.5 text-[11px] leading-tight text-text">{label}</p>
      {delta !== null && (
        <p className={`mt-1.5 text-[11px] font-semibold ${good ? "text-green" : bad ? "text-pink" : "text-text"}`}>
          {delta === 0 ? "stable" : lowerIsBetter ? `${delta > 0 ? "+" : ""}${delta} place${Math.abs(delta) > 1 ? "s" : ""}` : `${delta > 0 ? "+" : ""}${delta} %`}
        </p>
      )}
    </Card>
  );
}
