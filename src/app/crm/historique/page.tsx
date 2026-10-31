import Link from "next/link";
import type { EchangeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/roles";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { ECHANGE, ECHANGE_COULEUR, contactName, fmtTime, initialsOf, parisDay, parisMidnight, teamName, todayBounds } from "@/lib/crm";

export const metadata = { title: "Historique" };

const PERIODES = [{ v: "1", label: "Aujourd’hui" }, { v: "7", label: "7 jours" }, { v: "30", label: "30 jours" }] as const;
const TYPES: EchangeType[] = ["NRP", "APPEL", "MAIL", "PP", "PRISE_RDV", "RDV", "NO_SHOW"];

/** Historique général des échanges notés par l'équipe : un aperçu du travail fait, par personne. Réservé aux admins. */
export default async function HistoriquePage({ searchParams }: { searchParams: Promise<{ p?: string; c?: string; t?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const jours = Number(PERIODES.find((x) => x.v === sp.p)?.v ?? 7);
  const who = sp.c && sp.c !== "all" ? sp.c : null;
  const type = TYPES.includes(sp.t as EchangeType) ? (sp.t as EchangeType) : null;
  const { end } = todayBounds();
  const since = jours === 1 ? todayBounds().start : new Date(end.getTime() - jours * 86400_000);

  const [team, items] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, avatarUrl: true } }),
    prisma.echange.findMany({
      where: { auteurId: who ?? { not: null }, date: { gte: since, lt: end }, type: type ?? { not: "NOTE" }, prospectId: { not: null } },
      orderBy: { date: "desc" },
      take: 400,
      select: {
        id: true, type: true, notes: true, date: true, auteur: { select: { id: true, firstName: true, email: true, avatarUrl: true } },
        prospect: { select: { id: true, societe: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true } } } },
      },
    }),
  ]);
  // Compteur par personne (sur la période, tous types) pour les puces.
  const counts = await prisma.echange.groupBy({ by: ["auteurId"], where: { auteurId: { not: null }, date: { gte: since, lt: end }, type: { not: "NOTE" }, prospectId: { not: null } }, _count: true });
  const countOf = (id: string) => counts.find((c) => c.auteurId === id)?._count ?? 0;

  const days = new Map<string, typeof items>();
  for (const e of items) { const d = parisDay(e.date); days.set(d, [...(days.get(d) ?? []), e]); }
  const href = (q: Record<string, string | null>) => {
    const base: Record<string, string> = { p: String(jours), c: who ?? "all", t: type ?? "" };
    for (const [k, v] of Object.entries(q)) base[k] = v ?? "";
    return `/crm/historique?${new URLSearchParams(Object.fromEntries(Object.entries(base).filter(([, v]) => v)))}`;
  };
  const dayLabel = (d: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }).format(parisMidnight(d));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Historique</h1>
          <p className="mt-1 text-sm text-text">Tous les échanges notés par l’équipe{items.length === 400 ? " (les 400 plus récents)" : ""}.</p>
        </div>
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          {PERIODES.map((x) => <Link key={x.v} href={href({ p: x.v })} className={cn("rounded-full px-3 py-1.5", String(jours) === x.v ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{x.label}</Link>)}
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        <Link href={href({ c: "all" })} className={cn("flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1", !who ? "border-title bg-surface-2" : "border-border hover:border-text")}>
          <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-title">Tous</span>
          <span className="text-sm text-title">Équipe</span><span className="text-xs text-text">{counts.reduce((a, c) => a + c._count, 0)}</span>
        </Link>
        {team.map((u) => (
          <Link key={u.id} href={href({ c: u.id })} className={cn("flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1", who === u.id ? "border-title bg-surface-2" : "border-border hover:border-text")}>
            <Avatar initials={initialsOf(teamName(u))} src={u.avatarUrl} size={28} />
            <span className="text-sm text-title">{teamName(u)}</span><span className="text-xs text-text">{countOf(u.id)}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link href={href({ t: null })} className={cn("rounded-full border px-3 py-1 text-xs", !type ? "border-title bg-title font-semibold text-bg" : "border-border text-text hover:text-title")}>Tous types</Link>
        {TYPES.map((t) => (
          <Link key={t} href={href({ t })} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", type === t ? "border-title bg-title font-semibold text-bg" : "border-border text-text hover:text-title")}>
            <span className="size-2 rounded-full" style={{ background: ECHANGE_COULEUR[t] }} />{ECHANGE[t].short}
          </Link>
        ))}
      </div>

      {items.length === 0 ? <p className="mt-8 text-sm text-text">Aucun échange sur cette période.</p> : (
        [...days.entries()].map(([d, list]) => (
          <section key={d} className="mt-7">
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-title capitalize">{dayLabel(d)}<span className="text-xs font-normal text-text normal-case">{list.length} échange{list.length > 1 ? "s" : ""}</span></h2>
            <ol className="divide-y divide-border rounded-card border border-border bg-surface">
              {list.map((e) => (
                <li key={e.id} className="flex gap-3 px-4 py-3">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: ECHANGE_COULEUR[e.type] }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold text-title">{ECHANGE[e.type].short}</span>
                      <Link href={`/crm/prospects/${e.prospect!.id}`} className="truncate text-text-strong hover:underline">{contactName(e.prospect!.contacts[0]) ?? e.prospect!.societe}{contactName(e.prospect!.contacts[0]) ? ` · ${e.prospect!.societe}` : ""}</Link>
                    </p>
                    {e.notes && <p className="mt-0.5 text-sm whitespace-pre-line text-text">{e.notes.length > 300 ? e.notes.slice(0, 300) + "…" : e.notes}</p>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-text">
                    <p className="tabular-nums">{fmtTime(e.date)}</p>
                    {e.auteur && <p className="mt-0.5">{teamName(e.auteur)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </main>
  );
}
