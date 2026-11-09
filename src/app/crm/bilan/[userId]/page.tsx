import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { PeriodeBilan } from "@prisma/client";
import { ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, HistoryIcon, TargetIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProspection } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Card, SectionTitle } from "@/components/ui/card";
import { fmtDayTime, initialsOf, teamName } from "@/lib/crm";
import { INDICATEURS, PERIODES, atteinte, bornes, cle, fmtVal, historique, objectifs, parseDebut, resultats, type Indicateur } from "@/lib/bilans";
import { BilanForm, ObjectifsForm, SupprimerBilanButton } from "./form";

export const metadata = { title: "Bilan commercial" };

/** Fiche individuelle d'un commercial : résultats réels face aux trois objectifs, comptes rendus, historique. Résultats cliquables. */
export default async function BilanPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ periode?: string; debut?: string }> }) {
  const me = await requireProspection();
  const { userId: brut } = await params;
  const userId = brut === "moi" ? me.id : brut;
  if (brut === "moi") redirect(`/crm/bilan/${me.id}`);
  const direction = can(me, "pilotage"), soi = userId === me.id;
  if (!soi && !direction) redirect("/crm");
  const sp = await searchParams;
  const periode = (PERIODES.find((p) => p.key === sp.periode)?.key ?? "MENSUEL") as PeriodeBilan;
  const b = bornes(periode, parseDebut(sp.debut));
  const [u, res, obj, bilans, histo] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, email: true, avatarUrl: true, role: true } }),
    resultats(userId, b.debut, b.fin), objectifs(userId, periode, b.debut),
    prisma.bilanCommercial.findMany({ where: { userId, periode, debut: b.debut }, orderBy: { createdAt: "desc" } }),
    historique(userId, periode, b.debut, periode === "HEBDO" ? 8 : periode === "MENSUEL" ? 6 : 4),
  ]);
  if (!u || u.role === "CLIENT") notFound();
  const auteurs = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(bilans.map((x) => x.auteurId).filter((x): x is string => !!x))] } }, select: { id: true, firstName: true, email: true } })).map((a) => [a.id, teamName(a)]));
  const href = (q: { periode?: string; debut?: Date }) => `/crm/bilan/${userId}?periode=${q.periode ?? periode}&debut=${cle(q.debut ?? b.debut)}`;
  const detail = (ind: Indicateur) => `/crm/bilan/${userId}/detail?ind=${ind}&periode=${periode}&debut=${cle(b.debut)}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      {direction && <Link href="/admin/pilotage?onglet=commercial" className="text-sm text-text hover:text-title">← Pilotage · Commercial</Link>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Avatar initials={initialsOf(teamName(u))} src={u.avatarUrl} size={44} />
        <div><h1 className="text-2xl">{teamName(u)}</h1><p className="text-sm text-text">Bilan individuel · résultats lus dans Prospection et Suivi</p></div>
        <div className="ml-auto flex rounded-full border border-border p-0.5 text-sm">
          {PERIODES.map((p) => <Link key={p.key} href={href({ periode: p.key, debut: new Date() })} className={cn("rounded-full px-3 py-1.5", periode === p.key ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{p.label}</Link>)}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 rounded-card border border-border bg-surface px-3 py-2">
        <Link href={href({ debut: b.precedent })} aria-label="Période précédente" className="flex size-9 items-center justify-center rounded-full border border-border text-text hover:text-title"><ChevronLeftIcon size={16} /></Link>
        <p className="font-semibold text-title">{b.label}{b.enCours && <span className="ml-2 rounded-full bg-yellow/15 px-2 py-0.5 text-[11px] font-medium text-yellow">en cours</span>}</p>
        <Link href={href({ debut: b.suivant })} aria-label="Période suivante" className="flex size-9 items-center justify-center rounded-full border border-border text-text hover:text-title"><ChevronRightIcon size={16} /></Link>
      </div>

      {/* Résultats face aux objectifs : chaque résultat est cliquable et ouvre la liste de ce qui a été compté. */}
      <SectionTitle icon={TargetIcon}>Résultats et objectifs</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {INDICATEURS.map((i) => {
          const v = res.valeurs[i.key], o = obj[i.key];
          const cibles = [{ k: "P", label: "Personnel", val: o.personnel, cls: "text-blue" }, { k: "E", label: "Engagement", val: o.engagement, cls: "text-violet" }, { k: "F", label: "Fixé", val: o.fixe, cls: "text-yellow" }];
          const max = Math.max(1, v, ...cibles.map((c) => c.val ?? 0)) * 1.08;
          return (
            <Card key={i.key}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-title">{i.label}</p>
                <Link href={detail(i.key)} title="Voir le détail" className="font-title text-2xl font-extrabold text-title underline-offset-4 hover:underline">{fmtVal(i.key, v)}</Link>
              </div>
              <p className="text-[11px] text-muted">{i.aide}</p>
              {/* Barre du résultat avec les trois repères d'objectif (couleur + lettre : jamais la couleur seule). */}
              <div className="relative mt-3 h-3 overflow-visible rounded-full bg-surface-2">
                <div className="h-3 rounded-full bg-green" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
                {cibles.filter((c) => c.val !== null).map((c) => (
                  <span key={c.k} className={cn("absolute -top-1.5 flex h-6 w-px items-start justify-center bg-current", c.cls)} style={{ left: `${Math.min(100, ((c.val ?? 0) / max) * 100)}%` }} title={`${c.label} : ${fmtVal(i.key, c.val ?? 0)}`}><span className="mt-6 text-[10px] font-bold">{c.k}</span></span>
                ))}
              </div>
              <ul className="mt-5 grid grid-cols-3 gap-2 text-xs">
                {cibles.map((c) => { const a = atteinte(v, c.val); return (
                  <li key={c.k}><span className={cn("font-semibold", c.cls)}>{c.k} · {c.label}</span><br />{c.val === null ? <span className="text-muted">non fixé</span> : <>{fmtVal(i.key, c.val)} · <span className={a && a.pct >= 100 ? "text-green" : "text-text"}>{a?.pct} %</span><br /><span className={a && a.ecart >= 0 ? "text-green" : "text-pink"}>{a && a.ecart >= 0 ? "+" : ""}{a ? fmtVal(i.key, a.ecart) : ""}</span></>}</li>
                ); })}
              </ul>
            </Card>
          );
        })}
      </div>

      <SectionTitle icon={TargetIcon}>Objectifs de la période</SectionTitle>
      <ObjectifsForm userId={userId} periode={periode} debutKey={cle(b.debut)} objectifs={obj} soi={soi} direction={direction} />

      <SectionTitle icon={ClipboardListIcon}>Comptes rendus {PERIODES.find((p) => p.key === periode)?.pluriel}</SectionTitle>
      {bilans.length > 0 && <ul className="mb-3 space-y-2">{bilans.map((x) => <li key={x.id} className="rounded-card border border-border bg-surface p-3 text-sm"><div className="flex items-center gap-2 text-xs text-text"><span>{fmtDayTime(x.createdAt)}{x.auteurId ? ` · ${auteurs.get(x.auteurId) ?? ""}` : ""}</span>{(x.auteurId === me.id || direction) && <span className="ml-auto"><SupprimerBilanButton id={x.id} /></span>}</div><p className="mt-1 whitespace-pre-line text-text-strong">{x.contenu}</p></li>)}</ul>}
      <BilanForm userId={userId} periode={periode} debutKey={cle(b.debut)} label={b.label} />

      <SectionTitle icon={HistoryIcon}>Historique <span className="text-sm font-normal text-text">{PERIODES.find((p) => p.key === periode)?.pluriel} précédents</span></SectionTitle>
      <div className="overflow-x-auto rounded-card border border-border bg-surface"><table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] tracking-wide text-text uppercase"><th className="px-3 py-2 font-semibold">Période</th>{INDICATEURS.map((i) => <th key={i.key} className="px-3 py-2 text-right font-semibold">{i.label}<br /><span className="font-normal normal-case">réel / P · E · F</span></th>)}<th className="px-3 py-2 text-right font-semibold">CR</th></tr></thead>
        <tbody className="divide-y divide-border">
          {histo.map((h) => (
            <tr key={cle(h.debut)}>
              <td className="px-3 py-2"><Link href={href({ debut: h.debut })} className="font-semibold text-title hover:underline">{h.label}</Link></td>
              {INDICATEURS.map((i) => { const o = h.objectifs[i.key]; const f = (x: number | null) => (x === null ? "—" : fmtVal(i.key, x)); return <td key={i.key} className="px-3 py-2 text-right tabular-nums"><Link href={`/crm/bilan/${userId}/detail?ind=${i.key}&periode=${periode}&debut=${cle(h.debut)}`} className="font-semibold text-title hover:underline">{fmtVal(i.key, h.valeurs[i.key])}</Link><span className="block text-[11px] text-text">{f(o.personnel)} · {f(o.engagement)} · {f(o.fixe)}</span></td>; })}
              <td className="px-3 py-2 text-right text-xs text-text">{h.bilans || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </main>
  );
}
