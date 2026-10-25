import Link from "next/link";
import { CalendarClockIcon, PhoneCallIcon, PhoneIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Card, SectionTitle } from "@/components/ui/card";
import { STATUT, contactName, fmtDay, fmtTime, relanceInfo, teamName, todayBounds } from "@/lib/crm";
import type { ProspectStatut } from "@prisma/client";
import { EnablePush } from "@/components/push/enable-push";

const JOURNEE: ProspectStatut[] = ["A_RELANCER", "POSER_RDV", "A_SIGNER"];

export const metadata = { title: "Ma journée" };

export default async function MaJournee({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const me = await requireTeam();
  const equipe = (await searchParams).vue === "equipe";
  const { start, end } = todayBounds();
  const mine = equipe ? {} : { commercialId: me.id };
  const in7 = new Date(end.getTime() + 6 * 86400_000);

  const [due, rdvs, callsToday, doneToday] = await Promise.all([
    prisma.prospect.findMany({
      // « À contacter » = la base de leads (travaillée en session depuis le pipeline) ; ici seulement les relances.
      where: { ...mine, statut: { in: JOURNEE }, relanceAt: { lt: end } },
      orderBy: { relanceAt: "asc" },
      select: {
        id: true, societe: true, relanceAt: true, rappelAt: true, statut: true, telephone: true, commercial: { select: { firstName: true, email: true } },
        contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, telephone: true } },
        echanges: { where: { date: { gte: start } }, take: 1, select: { id: true } },
      },
    }),
    prisma.rendezVous.findMany({
      where: { ...(equipe ? {} : { commercialId: me.id }), resultat: "PREVU", debut: { gte: start, lt: in7 } },
      orderBy: { debut: "asc" },
      include: { prospect: { select: { id: true, societe: true, contacts: { where: { principal: true }, take: 1, select: { prenom: true, nom: true } } } } },
    }),
    prisma.echange.count({ where: { ...(equipe ? { auteurId: { not: null } } : { auteurId: me.id }), date: { gte: start }, type: { in: ["NRP", "APPEL", "PRISE_RDV"] } } }),
    prisma.echange.count({ where: { ...(equipe ? { auteurId: { not: null } } : { auteurId: me.id }), date: { gte: start } } }),
  ]);
  const todo = due.filter((p) => p.echanges.length === 0);
  const late = todo.filter((p) => relanceInfo(p.relanceAt).state === "late").length;
  const rdvToday = rdvs.filter((r) => r.debut < end).length;
  const hour = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date()), 10);

  const tiles = [
    { n: todo.length - late, label: "relances aujourd’hui", tone: "text-yellow" },
    { n: late, label: "en retard", tone: late ? "text-pink" : "text-muted" },
    { n: rdvToday, label: "RDV aujourd’hui", tone: "text-claude" },
    { n: callsToday, label: "appels passés", tone: "text-green" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="text-sm text-text capitalize">{fmtDay(new Date())}</p>
      <h1 className="text-2xl">{hour < 18 ? "Bonjour" : "Bonsoir"} {me.firstName ?? ""}</h1>
      <div className="mt-3 flex gap-1.5">
        <Link href="/crm" className={cn("rounded-full border px-3 py-1.5 text-sm", !equipe ? "border-title bg-title font-semibold text-bg" : "border-border text-text hover:text-title")}>Moi</Link>
        <Link href="/crm?vue=equipe" className={cn("rounded-full border px-3 py-1.5 text-sm", equipe ? "border-title bg-title font-semibold text-bg" : "border-border text-text hover:text-title")}>Toute l’équipe</Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <p className={cn("font-title text-3xl font-extrabold", t.n ? t.tone : "text-muted")}>{t.n}</p>
            <p className="mt-1 text-xs text-text">{t.label}</p>
          </Card>
        ))}
      </div>

      {!equipe && <div className="mt-4"><EnablePush compact /></div>}
      {doneToday > 0 && <p className="mt-2 text-center text-xs text-text">{doneToday} échange{doneToday > 1 ? "s" : ""} noté{doneToday > 1 ? "s" : ""} aujourd’hui</p>}

      <SectionTitle icon={PhoneCallIcon}>À appeler</SectionTitle>
      {todo.length === 0 ? <p className="text-sm text-text">Aucune relance (À relancer, Poser RDV, À signer) prévue aujourd’hui. Les leads « À contacter » se travaillent en session depuis le pipeline.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {todo.slice(0, 30).map((p) => {
            const c = p.contacts[0], r = relanceInfo(p.relanceAt), phone = c?.telephone ?? p.telephone;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/crm/prospects/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-title text-[15px] font-semibold text-title">{contactName(c) ?? p.societe}</p>
                  <p className="truncate text-xs text-text">{[contactName(c) ? p.societe : null, STATUT[p.statut].label, equipe && p.commercial ? teamName(p.commercial) : null].filter(Boolean).join(" · ")}</p>
                </Link>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", r.state === "late" ? "bg-pink/15 text-pink" : "bg-yellow/15 text-yellow")}>{p.rappelAt ? `${r.state === "today" ? "" : r.label + " "}${fmtTime(p.rappelAt)}` : r.label}</span>
                {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label="Appeler" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text hover:border-green hover:text-green"><PhoneIcon size={15} /></a>}
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle icon={CalendarClockIcon}>Rendez-vous des 7 prochains jours</SectionTitle>
      {rdvs.length === 0 ? <p className="text-sm text-text">Aucun rendez-vous prévu.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {rdvs.map((r) => (
            <li key={r.id}>
              <Link href={`/crm/prospects/${r.prospect.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="w-24 shrink-0 text-xs text-text capitalize">{fmtDay(r.debut)}<br /><span className="font-semibold text-title">{fmtTime(r.debut)}</span></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-title">{contactName(r.prospect.contacts[0]) ?? r.prospect.societe}</span>
                  <span className="block truncate text-xs text-text">{r.prospect.societe}{r.lieu ? ` · ${r.lieu}` : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
