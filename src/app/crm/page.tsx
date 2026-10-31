import Link from "next/link";
import { AlarmClockIcon, CalendarClockIcon, CheckIcon, PhoneCallIcon, PhoneIcon } from "lucide-react";
import type { ProspectStatut } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/roles";
import { requireProspection } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Card, SectionTitle } from "@/components/ui/card";
import { CLOS, STATUT, contactName, fmtDay, fmtTime, relanceInfo, teamName, todayBounds } from "@/lib/crm";
import { EnablePush } from "@/components/push/enable-push";
import { UrlSelect } from "@/components/crm/url-select";

/** Relances sans heure : seulement les fiches en cours de suivi (« À contacter » se travaille en session depuis le pipeline). */
const JOURNEE: ProspectStatut[] = ["A_RELANCER", "POSER_RDV", "A_SIGNER"];

export const metadata = { title: "Ma journée" };

/** « Journée de Lucas », « Journée d’Arsène ». */
const journeeDe = (n: string) => (/^[aeiouyhàâéèêëîïôöûüœ]/i.test(n) ? `Journée d’${n}` : `Journée de ${n}`);

type Slot = { id: string; at: Date; kind: "rappel" | "rdv"; prospectId: string; nom: string; detail: string; phone: string | null; fait: boolean; qui: string | null };

export default async function MaJournee({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const me = await requireProspection();
  const admin = me.role === "ADMIN";
  const vue = (await searchParams).vue;
  const equipe = vue === "equipe";
  // Les admins peuvent ouvrir la journée d'un autre membre de l'équipe (?vue=<id>).
  const team = await prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } });
  const autre = admin && vue && !equipe && vue !== me.id ? team.find((u) => u.id === vue) ?? null : null;
  const cibleId = autre?.id ?? me.id;
  const { start, end } = todayBounds();
  const now = new Date();
  const mine = equipe ? {} : { commercialId: cibleId };
  const in7 = new Date(end.getTime() + 6 * 86400_000);
  const contactSel = { orderBy: [{ principal: "desc" as const }, { createdAt: "asc" as const }], take: 1, select: { prenom: true, nom: true, telephone: true } };

  const [rappels, due, rdvs, callsToday] = await Promise.all([
    // Rappels à heure fixe du jour (toutes étapes sauf fiches closes), du plus tôt au plus tard.
    prisma.prospect.findMany({
      where: { ...mine, rappelAt: { gte: start, lt: end }, statut: { notIn: CLOS } },
      orderBy: { rappelAt: "asc" },
      select: { id: true, societe: true, rappelAt: true, statut: true, telephone: true, commercial: { select: { firstName: true, email: true } }, contacts: contactSel, echanges: { orderBy: { date: "desc" }, take: 1, select: { date: true } } },
    }),
    prisma.prospect.findMany({
      where: { ...mine, statut: { in: JOURNEE }, relanceAt: { lt: end }, OR: [{ rappelAt: null }, { rappelAt: { lt: start } }, { rappelAt: { gte: end } }] },
      orderBy: { relanceAt: "asc" },
      select: { id: true, societe: true, relanceAt: true, statut: true, telephone: true, commercial: { select: { firstName: true, email: true } }, contacts: contactSel, echanges: { where: { date: { gte: start } }, take: 1, select: { id: true } } },
    }),
    prisma.rendezVous.findMany({
      where: { ...(equipe ? {} : { commercialId: cibleId }), resultat: "PREVU", debut: { gte: start, lt: in7 } },
      orderBy: { debut: "asc" },
      include: { commercial: { select: { firstName: true, email: true } }, prospect: { select: { id: true, societe: true, telephone: true, contacts: contactSel } } },
    }),
    prisma.echange.count({ where: { ...(equipe ? { auteurId: { not: null } } : { auteurId: cibleId }), date: { gte: start }, type: { in: ["NRP", "APPEL", "PRISE_RDV"] } } }),
  ]);

  // Planning du jour : rappels à heure fixe + RDV du jour, dans l'ordre chronologique.
  const planning: Slot[] = [
    ...rappels.map((p) => ({
      id: `r-${p.id}`, at: p.rappelAt!, kind: "rappel" as const, prospectId: p.id, nom: contactName(p.contacts[0]) ?? p.societe,
      detail: [contactName(p.contacts[0]) ? p.societe : null, STATUT[p.statut].label].filter(Boolean).join(" · "),
      phone: p.contacts[0]?.telephone ?? p.telephone, fait: !!p.echanges[0] && p.echanges[0].date >= new Date(p.rappelAt!.getTime() - 30 * 60_000), qui: p.commercial ? teamName(p.commercial) : null,
    })),
    ...rdvs.filter((r) => r.debut < end).map((r) => ({
      id: `v-${r.id}`, at: r.debut, kind: "rdv" as const, prospectId: r.prospect.id, nom: contactName(r.prospect.contacts[0]) ?? r.prospect.societe,
      detail: [contactName(r.prospect.contacts[0]) ? r.prospect.societe : null, r.lieu ?? "Rendez-vous"].filter(Boolean).join(" · "),
      phone: r.prospect.contacts[0]?.telephone ?? r.prospect.telephone, fait: false, qui: r.commercial ? teamName(r.commercial) : null,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const todo = due.filter((p) => p.echanges.length === 0);
  const late = todo.filter((p) => relanceInfo(p.relanceAt).state === "late").length;
  const aVenir = planning.filter((s) => !s.fait && s.at.getTime() > now.getTime() - 15 * 60_000).length;
  const hour = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(now), 10);
  const prochain = planning.find((s) => !s.fait && s.at.getTime() > now.getTime() - 15 * 60_000);

  const tiles = [
    { n: planning.length, label: "rappels et RDV à heure fixe", tone: "text-blue" },
    { n: todo.length - late, label: "à appeler (sans heure)", tone: "text-yellow" },
    { n: late, label: "en retard", tone: late ? "text-pink" : "text-muted" },
    { n: callsToday, label: "appels passés", tone: "text-green" },
  ];

  const etat = (s: Slot) => {
    if (s.fait) return { label: "Fait", cls: "border-border bg-surface-2 text-text", line: "bg-border" };
    const diff = s.at.getTime() - now.getTime();
    if (diff < -15 * 60_000) return { label: "Passé", cls: "border-pink/40 bg-pink/10 text-pink", line: "bg-pink" };
    if (diff <= 15 * 60_000) return { label: "Maintenant", cls: "border-yellow/50 bg-yellow/15 text-yellow", line: "bg-yellow" };
    return { label: s.kind === "rdv" ? "RDV" : "Rappel", cls: s.kind === "rdv" ? "border-claude/40 bg-claude/10 text-claude" : "border-blue/40 bg-blue/10 text-blue", line: s.kind === "rdv" ? "bg-claude" : "bg-blue" };
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="text-sm text-text capitalize">{fmtDay(now)}</p>
      <h1 className="text-2xl">{autre ? journeeDe(teamName(autre)) : `${hour < 18 ? "Bonjour" : "Bonsoir"} ${me.firstName ?? ""}`}</h1>
      <p className="mt-1 text-sm text-text">
        {prochain ? <>Prochain : <span className="font-semibold text-title">{fmtTime(prochain.at)}</span> · {prochain.nom}{aVenir > 1 ? ` (puis ${aVenir - 1} autre${aVenir > 2 ? "s" : ""})` : ""}</> : planning.length ? "Plus rien à heure fixe aujourd’hui." : "Aucun rappel à heure fixe aujourd’hui."}
      </p>
      <UrlSelect
        className="mt-3 w-full sm:w-64"
        label="Vue"
        value={equipe ? "equipe" : autre ? autre.id : "me"}
        options={[
          { value: "me", label: "Ma journée", href: "/crm" },
          { value: "equipe", label: "Toute l’équipe", href: "/crm?vue=equipe" },
          ...(admin ? team.filter((u) => u.id !== me.id).map((u) => ({ value: u.id, label: journeeDe(teamName(u)), href: `/crm?vue=${u.id}` })) : []),
        ]}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <p className={cn("font-title text-3xl font-extrabold", t.n ? t.tone : "text-muted")}>{t.n}</p>
            <p className="mt-1 text-xs text-text">{t.label}</p>
          </Card>
        ))}
      </div>
      {!equipe && !autre && <div className="mt-4"><EnablePush compact texte="Recevez une notification à l’heure de vos rappels de relance." /></div>}

      {/* 1. Planning à heure fixe, en premier, dans l'ordre de la journée */}
      <SectionTitle icon={AlarmClockIcon}>À heure fixe</SectionTitle>
      {planning.length === 0 ? (
        <p className="text-sm text-text">Aucun rappel ni RDV à heure fixe aujourd’hui. Ajoutez une heure à une relance (dans « Noter un échange ») pour la retrouver ici et recevoir un rappel.</p>
      ) : (
        <ol className="relative space-y-2">
          {planning.map((s) => {
            const e = etat(s);
            return (
              <li key={s.id} className={cn("flex items-stretch gap-3", s.fait && "opacity-60")}>
                <div className="flex w-16 shrink-0 flex-col items-end pt-2.5">
                  <span className={cn("font-title text-lg leading-none font-extrabold tabular-nums", s.fait ? "text-text line-through" : "text-title")}>{fmtTime(s.at)}</span>
                </div>
                <div className={cn("w-1 shrink-0 rounded-full", e.line)} aria-hidden />
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
                  <Link href={`/crm/prospects/${s.prospectId}`} className="min-w-0 flex-1">
                    <p className="truncate font-title text-[15px] font-semibold text-title">{s.nom}</p>
                    <p className="truncate text-xs text-text">{s.detail}{equipe && s.qui ? ` · ${s.qui}` : ""}</p>
                  </Link>
                  <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", e.cls)}>
                    {s.fait && <CheckIcon size={11} aria-hidden />}{e.label === "Maintenant" && <span className="size-1.5 animate-pulse rounded-full bg-yellow" />}{e.label}
                  </span>
                  {s.phone && !s.fait && <a href={`tel:${s.phone.replace(/\s/g, "")}`} aria-label="Appeler" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text hover:border-green hover:text-green"><PhoneIcon size={15} /></a>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* 2. Le reste des relances du jour, sans heure */}
      <SectionTitle icon={PhoneCallIcon}>À appeler dans la journée</SectionTitle>
      {todo.length === 0 ? <p className="text-sm text-text">Aucune relance sans heure (À relancer, Poser RDV, À signer) pour aujourd’hui. Les leads « À contacter » se travaillent en session depuis le pipeline.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {todo.slice(0, 40).map((p) => {
            const c = p.contacts[0], r = relanceInfo(p.relanceAt), phone = c?.telephone ?? p.telephone;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/crm/prospects/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-title text-[15px] font-semibold text-title">{contactName(c) ?? p.societe}</p>
                  <p className="truncate text-xs text-text">{[contactName(c) ? p.societe : null, STATUT[p.statut].label, equipe && p.commercial ? teamName(p.commercial) : null].filter(Boolean).join(" · ")}</p>
                </Link>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", r.state === "late" ? "bg-pink/15 text-pink" : "bg-yellow/15 text-yellow")}>{r.label}</span>
                {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label="Appeler" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text hover:border-green hover:text-green"><PhoneIcon size={15} /></a>}
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle icon={CalendarClockIcon} action={<Link href="/crm/calendrier?vue=semaine" className="text-sm text-text hover:text-title">Calendrier</Link>}>Rendez-vous des 7 prochains jours</SectionTitle>
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
