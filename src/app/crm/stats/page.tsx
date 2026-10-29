import Link from "next/link";
import type { EchangeType, ProspectStatut } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { ECHANGE, ECHANGE_COULEUR, PIPELINE, STATUT, STATUT_COULEUR, parisDay, teamName, todayBounds, VIZ } from "@/lib/crm";
import { Avatar } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/crm";
import { Donut, Funnel, GroupedBars, HBars, KpiTile, Panel, StackedBars, type Bucket } from "./charts";

export const metadata = { title: "Stats" };

const PERIODES = [
  { v: "7", label: "7 jours" },
  { v: "30", label: "30 jours" },
  { v: "90", label: "3 mois" },
  { v: "365", label: "12 mois" },
] as const;
const TYPES_ACTIVITE: EchangeType[] = ["NRP", "APPEL", "MAIL", "PP", "PRISE_RDV", "RDV", "NO_SHOW"];
const APPELS: EchangeType[] = ["NRP", "APPEL", "PRISE_RDV"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ca = (p: { fraisCreationEuros: number | null; mensuelEuros: number | null }) => (p.fraisCreationEuros ?? 0) + 12 * (p.mensuelEuros ?? 0);

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ p?: string; c?: string }> }) {
  const me = await requireTeam();
  const sp = await searchParams;
  const jours = Number(PERIODES.find((x) => x.v === sp.p)?.v ?? 30);
  const who = sp.c && sp.c !== "all" ? sp.c : null;
  const { end } = todayBounds();
  const since = new Date(end.getTime() - jours * 86400_000);
  const prevSince = new Date(since.getTime() - jours * 86400_000);

  const byAuteur = who ? { auteurId: who } : { auteurId: { not: null } };
  const byCommercial = who ? { commercialId: who } : {};

  const [team, wonAll, echanges, prevEchanges, rdvPris, prevRdvPris, rdvTenus, wins, prevWins, pipeline] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, avatarUrl: true } }),
    prisma.prospect.findMany({ where: { statut: "GAGNE" }, select: { commercialId: true, fraisCreationEuros: true, mensuelEuros: true } }),
    prisma.echange.findMany({ where: { ...byAuteur, date: { gte: since, lt: end } }, select: { type: true, date: true, auteurId: true, prospectId: true } }),
    prisma.echange.findMany({ where: { ...byAuteur, date: { gte: prevSince, lt: since } }, select: { type: true, prospectId: true } }),
    prisma.rendezVous.findMany({ where: { ...byCommercial, createdAt: { gte: since, lt: end } }, select: { createdAt: true, resultat: true, commercialId: true, reportDeId: true } }),
    prisma.rendezVous.count({ where: { ...byCommercial, createdAt: { gte: prevSince, lt: since }, resultat: { notIn: ["NO_SHOW", "ANNULE"] }, reportDeId: null } }),
    prisma.rendezVous.findMany({ where: { ...byCommercial, debut: { gte: since, lt: end }, resultat: { in: ["FAIT", "NO_SHOW"] } }, select: { debut: true, resultat: true, commercialId: true } }),
    prisma.prospect.findMany({ where: { ...byCommercial, statut: "GAGNE", gagneAt: { gte: since, lt: end } }, select: { commercialId: true, fraisCreationEuros: true, mensuelEuros: true } }),
    prisma.prospect.findMany({ where: { ...byCommercial, statut: "GAGNE", gagneAt: { gte: prevSince, lt: since } }, select: { fraisCreationEuros: true, mensuelEuros: true } }),
    prisma.prospect.findMany({ where: byCommercial, select: { statut: true, potentielEuros: true, fraisCreationEuros: true, mensuelEuros: true } }),
  ]);

  // ─── Chiffres clés ───
  const appels = echanges.filter((e) => APPELS.includes(e.type)).length;
  const prevAppels = prevEchanges.filter((e) => APPELS.includes(e.type)).length;
  // RDV pris : ni no show, ni annulé, ni report d'un no show.
  const pris = rdvPris.filter((r) => r.resultat !== "NO_SHOW" && r.resultat !== "ANNULE" && !r.reportDeId);
  const reports = rdvPris.filter((r) => r.reportDeId).length;
  const honores = rdvTenus.filter((r) => r.resultat === "FAIT").length;
  const noShows = rdvTenus.filter((r) => r.resultat === "NO_SHOW").length;
  const tauxNoShow = honores + noShows ? Math.round((noShows / (honores + noShows)) * 100) : null;
  const caPeriode = wins.reduce((a, p) => a + ca(p), 0);
  const prevCa = prevWins.reduce((a, p) => a + ca(p), 0);
  const contactes = new Set(echanges.map((e) => e.prospectId).filter(Boolean)).size;
  const transfo = contactes ? Math.round((wins.length / contactes) * 1000) / 10 : null;

  // ─── Séries dans le temps : par jour (≤ 30 j), par semaine (3 mois), par mois (12 mois) ───
  const unit: "jour" | "semaine" | "mois" = jours <= 30 ? "jour" : jours <= 90 ? "semaine" : "mois";
  const buckets: { key: string; label: string; start: number }[] = [];
  if (unit === "mois") {
    const [y, m] = parisDay(new Date(end.getTime() - 1)).split("-").map(Number);
    for (let i = 11; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); buckets.push({ key: d.toISOString().slice(0, 7), label: MOIS[d.getUTCMonth()], start: 0 }); }
  } else {
    const step = unit === "jour" ? 1 : 7;
    for (let t = since.getTime(); t < end.getTime(); t += step * 86400_000) {
      const day = parisDay(new Date(t + 12 * 3600_000));
      const [, mm, dd] = day.split("-").map(Number);
      buckets.push({ key: day, label: unit === "jour" ? (jours <= 7 ? new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(t + 12 * 3600_000)) : `${dd}`) : `${dd} ${MOIS[mm - 1]}`, start: t });
    }
  }
  const bucketOf = (d: Date) => {
    if (unit === "mois") return parisDay(d).slice(0, 7);
    const t = d.getTime();
    for (let i = buckets.length - 1; i >= 0; i--) if (t >= buckets[i].start) return buckets[i].key;
    return null;
  };
  const activite: Bucket[] = buckets.map((b) => ({ key: b.key, label: b.label, values: {} }));
  const idx = new Map(activite.map((b, i) => [b.key, i]));
  for (const e of echanges) {
    if (e.type === "NOTE") continue;
    const i = idx.get(bucketOf(e.date) ?? "");
    if (i !== undefined) activite[i].values[e.type] = (activite[i].values[e.type] ?? 0) + 1;
  }
  const rdvSerie: Bucket[] = buckets.map((b) => ({ key: b.key, label: b.label, values: { pris: 0, noshow: 0 } }));
  for (const r of pris) { const i = idx.get(bucketOf(r.createdAt) ?? ""); if (i !== undefined) rdvSerie[i].values.pris++; }
  for (const r of rdvTenus) if (r.resultat === "NO_SHOW") { const i = idx.get(bucketOf(r.debut) ?? ""); if (i !== undefined) rdvSerie[i].values.noshow++; }

  const euros = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const parType = TYPES_ACTIVITE.map((t) => ({ label: ECHANGE[t].short, value: echanges.filter((e) => e.type === t).length, color: ECHANGE_COULEUR[t] }));
  const statuts: ProspectStatut[] = [...PIPELINE, "GAGNE", "PERDU", "ABANDON"];
  // CA potentiel d'un prospect : création (si connue) + 12 mois d'abonnement (signé, sinon le potentiel €/mois).
  const caPot = (p: (typeof pipeline)[number]) => (p.fraisCreationEuros ?? 0) + 12 * (p.mensuelEuros ?? p.potentielEuros ?? 0);
  const donut = statuts.map((s) => {
    const ps = pipeline.filter((p) => p.statut === s);
    return { label: STATUT[s].label, value: ps.length, color: STATUT_COULEUR[s], montant: s === "PERDU" || s === "ABANDON" ? null : euros(ps.reduce((a, p) => a + caPot(p), 0)) };
  });
  const ouverts = pipeline.filter((p) => PIPELINE.includes(p.statut));
  const caPotentiel = ouverts.reduce((a, p) => a + caPot(p), 0);
  const sansPotentiel = ouverts.filter((p) => !caPot(p)).length;

  // ─── Classement ───
  const rows = team.map((u) => {
    const mine = (id: string | null) => id === u.id;
    const w = wins.filter((p) => mine(p.commercialId));
    return {
      u,
      activites: echanges.filter((e) => mine(e.auteurId) && e.type !== "NOTE").length,
      appels: echanges.filter((e) => mine(e.auteurId) && APPELS.includes(e.type)).length,
      rdv: pris.filter((r) => mine(r.commercialId)).length,
      noshow: rdvTenus.filter((r) => mine(r.commercialId) && r.resultat === "NO_SHOW").length,
      signes: w.length,
      ca: w.reduce((a, p) => a + ca(p), 0),
    };
  }).filter((r) => !who || r.u.id === who).sort((a, b) => b.ca - a.ca || b.rdv - a.rdv || b.activites - a.activites);

  const caTotal = (id: string) => wonAll.filter((p) => p.commercialId === id).reduce((a, p) => a + ca(p), 0);
  const href = (q: Record<string, string>) => `/crm/stats?${new URLSearchParams({ p: String(jours), c: who ?? "all", ...q })}`;
  const unitLabel = unit === "jour" ? "par jour" : unit === "semaine" ? "par semaine" : "par mois";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Stats</h1>
          <p className="mt-1 text-sm text-text">{who ? `Les chiffres de ${teamName(team.find((u) => u.id === who) ?? me)}` : "Toute l’équipe"} sur {PERIODES.find((x) => x.v === String(jours))?.label}. Les no show et leurs reports ne comptent pas dans les RDV pris.</p>
        </div>
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          {PERIODES.map((x) => (
            <Link key={x.v} href={href({ p: x.v })} className={cn("rounded-full px-3 py-1.5", String(jours) === x.v ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{x.label}</Link>
          ))}
        </div>
      </div>

      {/* Sélection du commercial : filtre toute la page */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        <Link href={href({ c: "all" })} className={cn("flex shrink-0 items-center gap-2.5 rounded-card border px-3 py-2", !who ? "border-title bg-surface-2" : "border-border bg-surface hover:border-text")}>
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-title">Tous</span>
          <span><span className="block text-sm font-semibold text-title">Équipe</span><span className="block text-xs text-text">{euros(team.reduce((a, u) => a + caTotal(u.id), 0))}</span></span>
        </Link>
        {team.map((u) => (
          <Link key={u.id} href={href({ c: u.id })} className={cn("flex shrink-0 items-center gap-2.5 rounded-card border px-3 py-2", who === u.id ? "border-title bg-surface-2" : "border-border bg-surface hover:border-text")}>
            <Avatar initials={initialsOf(teamName(u))} src={u.avatarUrl} />
            <span><span className="block text-sm font-semibold text-title">{teamName(u)}</span><span className="block text-xs text-text">{euros(caTotal(u.id))} signés</span></span>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label="Appels passés" value={String(appels)} now={appels} prev={prevAppels} color={VIZ.blue} />
        <KpiTile label="RDV pris" value={String(pris.length)} now={pris.length} prev={prevRdvPris} color={VIZ.orange} sub={`${honores} honoré${honores > 1 ? "s" : ""}`} />
        <KpiTile label="No show" value={String(noShows)} color={VIZ.red} sub={`${tauxNoShow === null ? "aucun RDV passé" : `${tauxNoShow} % des RDV passés`}${reports ? ` · ${reports} reporté${reports > 1 ? "s" : ""}` : ""}`} />
        <KpiTile label="Signatures" value={String(wins.length)} now={wins.length} prev={prevWins.length} color={VIZ.aqua} sub={transfo === null ? undefined : `${transfo} % des contactés`} />
        <KpiTile label="CA signé" value={euros(caPeriode)} now={caPeriode} prev={prevCa} color={VIZ.green} sub="création + 12 mois" className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Activité" subtitle={`Échanges notés ${unitLabel}, par type`} className="lg:col-span-2">
          <StackedBars buckets={activite} series={TYPES_ACTIVITE.map((t) => ({ key: t, label: ECHANGE[t].short, color: ECHANGE_COULEUR[t] }))} />
        </Panel>
        <Panel title="Répartition" subtitle={`${echanges.filter((e) => e.type !== "NOTE").length} échanges sur la période`}>
          <HBars items={parType} />
        </Panel>
        <Panel title="Rendez-vous" subtitle={`RDV pris ${unitLabel} (sans les no show ni leurs reports) et no show`} className="lg:col-span-2">
          <GroupedBars buckets={rdvSerie} series={[{ key: "pris", label: "RDV pris", color: VIZ.orange }, { key: "noshow", label: "No show", color: VIZ.red }]} />
        </Panel>
        <Panel title="Pipeline" subtitle={`CA potentiel des prospects en cours (création + 12 mois)${sansPotentiel ? ` · ${sansPotentiel} sans potentiel renseigné` : ""}`}>
          <Donut items={donut} center={{ value: euros(caPotentiel), label: "CA potentiel" }} />
        </Panel>
        <Panel title="Du premier appel à la signature" subtitle="Sur la période" className="lg:col-span-3">
          <Funnel steps={[
            { label: "Prospects contactés", value: contactes, color: VIZ.blue },
            { label: "RDV pris", value: pris.length, color: VIZ.orange },
            { label: "RDV honorés", value: honores, color: VIZ.magenta },
            { label: "Signatures", value: wins.length, color: VIZ.aqua },
          ]} />
        </Panel>
      </div>

      <Panel title="Classement" subtitle="Sur la période, trié par CA signé" className="mt-4">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-text"><th className="py-2 font-medium">Commercial</th><th className="py-2 text-right font-medium">Activités</th><th className="py-2 text-right font-medium">Appels</th><th className="py-2 text-right font-medium">RDV pris</th><th className="py-2 text-right font-medium">No show</th><th className="py-2 text-right font-medium">Signés</th><th className="py-2 text-right font-medium">CA signé</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.u.id} className="border-t border-border">
                  <td className="py-2.5"><span className="flex items-center gap-2"><span className="w-4 text-xs text-muted">{i + 1}</span><Avatar initials={initialsOf(teamName(r.u))} src={r.u.avatarUrl} size={28} /><span className="font-semibold text-title">{teamName(r.u)}</span></span></td>
                  <td className="py-2.5 text-right tabular-nums text-text-strong">{r.activites}</td>
                  <td className="py-2.5 text-right tabular-nums text-text-strong">{r.appels}</td>
                  <td className="py-2.5 text-right tabular-nums text-text-strong">{r.rdv}</td>
                  <td className="py-2.5 text-right tabular-nums text-text-strong">{r.noshow}</td>
                  <td className="py-2.5 text-right tabular-nums text-text-strong">{r.signes}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-title">{euros(r.ca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}
