import { UrlSelect } from "@/components/crm/url-select";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { contactName, initialsOf, parisDay, parisMidnight, teamName } from "@/lib/crm";
import { Calendar, type CalEvent, type Vue } from "./calendar";

export const metadata = { title: "Calendrier" };

const VUES: { v: Vue; label: string }[] = [{ v: "jour", label: "Jour" }, { v: "semaine", label: "Semaine" }, { v: "mois", label: "Mois" }];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Jour « YYYY-MM-DD » décalé de n jours (calcul à midi UTC : pas de souci d'heure d'été). */
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi

export default async function CalendrierPage({ searchParams }: { searchParams: Promise<{ vue?: string; d?: string; c?: string; rappels?: string }> }) {
  const me = await requireTeam();
  const sp = await searchParams;
  const vue: Vue = sp.vue === "jour" || sp.vue === "mois" ? sp.vue : "semaine";
  const today = parisDay();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today;
  const who = sp.c ?? "me";
  const avecRappels = sp.rappels !== "0";

  // Période affichée.
  let first = d, days = 1;
  if (vue === "semaine") { first = shift(d, -weekday(d)); days = 7; }
  if (vue === "mois") { const m1 = `${d.slice(0, 8)}01`; first = shift(m1, -weekday(m1)); days = 42; }
  const from = parisMidnight(first), to = parisMidnight(shift(first, days));
  const byCommercial = who === "all" ? {} : who === "me" ? { commercialId: me.id } : { commercialId: who };

  const [rdvs, rappels, team] = await Promise.all([
    prisma.rendezVous.findMany({
      where: { ...byCommercial, debut: { gte: from, lt: to } },
      orderBy: { debut: "asc" },
      include: { commercial: { select: { firstName: true, email: true } }, prospect: { select: { id: true, societe: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true } } } } },
    }),
    avecRappels ? prisma.prospect.findMany({
      where: { ...byCommercial, rappelAt: { gte: from, lt: to }, statut: { notIn: ["GAGNE", "PERDU"] } },
      select: { id: true, societe: true, rappelAt: true, commercial: { select: { firstName: true, email: true } }, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true } } },
    }) : Promise.resolve([]),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
  ]);

  const events: CalEvent[] = [
    ...rdvs.map((r) => ({
      id: r.id, kind: "rdv" as const, at: r.debut.toISOString(), duree: r.dureeMin, prospectId: r.prospect.id,
      nom: contactName(r.prospect.contacts[0]) ?? r.prospect.societe, societe: r.prospect.societe,
      objet: r.reportDeId ? `RDV reporté${r.lieu ? ` · ${r.lieu}` : ""}` : r.lieu ? `RDV · ${r.lieu}` : "Rendez-vous", resultat: r.resultat,
      qui: r.commercial ? initialsOf(teamName(r.commercial)) : null,
    })),
    ...rappels.map((p) => ({
      id: `rap-${p.id}`, kind: "rappel" as const, at: p.rappelAt!.toISOString(), duree: 20, prospectId: p.id,
      nom: contactName(p.contacts[0]) ?? p.societe, societe: p.societe, objet: "Rappel téléphonique", resultat: null,
      qui: p.commercial ? initialsOf(teamName(p.commercial)) : null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const step = vue === "jour" ? 1 : vue === "semaine" ? 7 : 0;
  const prevD = vue === "mois" ? `${shift(`${d.slice(0, 8)}01`, -1).slice(0, 8)}01` : shift(d, -step);
  const nextD = vue === "mois" ? `${shift(`${d.slice(0, 8)}01`, 32).slice(0, 8)}01` : shift(d, step);
  const href = (q: Record<string, string>) => `/crm/calendrier?${new URLSearchParams({ vue, d, c: who, ...(avecRappels ? {} : { rappels: "0" }), ...q })}`;
  const [y, m] = d.split("-").map(Number);
  const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...o }).format(new Date(`${day}T12:00:00Z`));
  const titre = vue === "jour" ? fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : vue === "semaine" ? `${fmt(first, { day: "numeric", month: "short" })} au ${fmt(shift(first, 6), { day: "numeric", month: "short", year: "numeric" })}`
    : `${MOIS[m - 1]} ${y}`;
  const chips = [{ id: "me", label: "Moi" }, { id: "all", label: "Toute l’équipe" }, ...team.filter((u) => u.id !== me.id).map((u) => ({ id: u.id, label: teamName(u) }))];

  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link href={href({ d: prevD })} aria-label="Précédent" className="flex size-9 items-center justify-center rounded-full border border-border text-text hover:text-title"><ChevronLeftIcon size={17} /></Link>
          <Link href={href({ d: today })} className="rounded-full border border-border px-3 py-1.5 text-sm text-title hover:border-text">Aujourd’hui</Link>
          <Link href={href({ d: nextD })} aria-label="Suivant" className="flex size-9 items-center justify-center rounded-full border border-border text-text hover:text-title"><ChevronRightIcon size={17} /></Link>
        </div>
        <h1 className="text-xl capitalize">{titre}</h1>
        <div className="ml-auto flex rounded-full border border-border p-0.5 text-sm">
          {VUES.map((x) => <Link key={x.v} href={href({ vue: x.v })} className={cn("rounded-full px-3 py-1.5", vue === x.v ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{x.label}</Link>)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <UrlSelect className="w-full sm:w-56" label="Agenda de" value={chips.some((c) => c.id === who) ? who : "me"} options={chips.map((c) => ({ value: c.id, label: c.label, href: href({ c: c.id }) }))} />
        <Link href={`/crm/calendrier?${new URLSearchParams({ vue, d, c: who, ...(avecRappels ? { rappels: "0" } : {}) })}`} className={cn("ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", avecRappels ? "border-blue/50 text-blue" : "border-border text-text")}>
          <span className={cn("size-2 rounded-full border border-blue", avecRappels && "bg-blue")} /> Rappels à heure fixe
        </Link>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text">
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-claude" />RDV prévu</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-green" />Honoré</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-pink" />No show</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-muted" />Annulé</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-sm border border-dashed border-blue" />Rappel</li>
      </ul>
      <div className="mt-4">
        <Calendar vue={vue} first={first} days={days} today={today} month={d.slice(0, 7)} events={events} base={`/crm/calendrier?${new URLSearchParams({ c: who, ...(avecRappels ? {} : { rappels: "0" }) })}`} />
      </div>
    </main>
  );
}
