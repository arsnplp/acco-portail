import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AircallBloc, GmailBloc, isAircallMeta, isGmailMeta } from "@/components/crm/echange-detail";
import { fmtDayTime, parisDay, teamName } from "@/lib/crm";
import { MODULES } from "@/lib/roles";
import { CANAL_LABEL, timelineClient, type Canal } from "@/lib/timeline";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/format";
import { CompteRenduForm } from "../suivi-forms";
import { RattacherAppelButton, RattacherEmailForm, SyncEmailsButton } from "../forms";
import { appelsNonRattaches } from "@/lib/aircall";
import type { Ctx } from "./ctx";

const PERIODES: Array<[string, string, number | null]> = [["30", "30 jours", 30], ["90", "3 mois", 90], ["365", "1 an", 365], ["tout", "Tout", null]];

/** Onglet Activité (4.5) : timeline filtrable par canal, période, collaborateur et site ; Emails et Appels : vues spécialisées. */
export async function ActiviteOnglet({ clientId, sp, mode, externe }: Ctx & { mode: "activite" | "emails" | "appels" }) {
  const canal = (sp.canal && sp.canal in CANAL_LABEL ? sp.canal : null) as Canal | null;
  const periode = PERIODES.find(([k]) => k === sp.periode) ?? PERIODES[1];
  const depuis = periode[2] ? addDays(-periode[2]) : null;
  const canaux: Canal[] | undefined = mode === "emails" ? ["email"] : mode === "appels" ? ["appel"] : canal ? [canal] : undefined;
  const [items, equipe, sites] = await Promise.all([
    timelineClient(clientId, { canaux, depuis, auteurId: sp.qui || null, siteId: sp.site || null, limite: 300 }),
    prisma.user.findMany({ where: { role: { in: MODULES.suivi } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
    prisma.site.findMany({ where: { clientId }, select: { id: true, name: true } }),
  ]);
  const contacts = [...new Set(items.map((i) => i.contact).filter((c): c is string => !!c))];
  const inconnus = mode === "appels" && !externe ? await appelsNonRattaches(20) : [];
  const visibles = (externe ? items.filter((i) => !i.interne) : items).filter((i) => !sp.contact || i.contact === sp.contact);
  const base = `/admin/clients/${clientId}?onglet=${mode}`;
  const href = (patch: Record<string, string | null>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ canal: sp.canal ?? "", periode: sp.periode ?? "", qui: sp.qui ?? "", site: sp.site ?? "", contact: sp.contact ?? "", ...patch })) if (v) p.set(k, v); const q = p.toString(); return q ? `${base}&${q}` : base; };
  const sel = "h-9 appearance-none rounded-full border border-border bg-surface px-3 text-xs text-title outline-none hover:border-text";
  return (
    <div>
      {mode === "activite" && !externe && <CompteRenduForm clientId={clientId} today={parisDay()} />}
      {mode === "emails" && !externe && <div className="flex flex-wrap items-end gap-3"><SyncEmailsButton clientId={clientId} /><RattacherEmailForm clientId={clientId} /></div>}
      {inconnus.length > 0 && (
        <details className="rounded-card border border-border bg-surface px-4 py-3 text-sm"><summary className="cursor-pointer text-text">{inconnus.length} appel{inconnus.length > 1 ? "s" : ""} Aircall non rattaché{inconnus.length > 1 ? "s" : ""} (numéros inconnus)</summary>
          <ul className="mt-2 space-y-1 text-xs">{inconnus.map((e) => <li key={e.id} className="flex items-center gap-2"><span className="flex-1 text-text-strong">{e.notes} · {fmtDayTime(e.date)}{e.auteur ? ` · ${teamName(e.auteur)}` : e.auteurNom ? ` · ${e.auteurNom}` : ""}{isAircallMeta(e.meta) ? ` · ${e.meta.numero}` : ""}</span><RattacherAppelButton clientId={clientId} echangeId={e.id} /></li>)}</ul>
        </details>
      )}
      <form method="get" action={`/admin/clients/${clientId}`} className="mt-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="onglet" value={mode} />
        {mode === "activite" && (
          <select name="canal" defaultValue={canal ?? ""} className={sel} aria-label="Canal"><option value="">Tous les canaux</option>{(Object.keys(CANAL_LABEL) as Canal[]).map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}</select>
        )}
        <div className="flex rounded-full border border-border p-0.5 text-xs">{PERIODES.map(([k, l]) => <Link key={k} href={href({ periode: k })} className={cn("rounded-full px-2.5 py-1", periode[0] === k ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{l}</Link>)}</div>
        <select name="qui" defaultValue={sp.qui ?? ""} className={sel} aria-label="Collaborateur"><option value="">Toute l’équipe</option>{equipe.map((u) => <option key={u.id} value={u.id}>{teamName(u)}</option>)}</select>
        {sites.length > 1 && <select name="site" defaultValue={sp.site ?? ""} className={sel} aria-label="Site"><option value="">Tous les sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        {contacts.length > 0 && <select name="contact" defaultValue={sp.contact ?? ""} className={sel} aria-label="Contact"><option value="">Tous les contacts</option>{contacts.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
        <input type="hidden" name="periode" value={periode[0]} />
        <button type="submit" className="h-9 rounded-full border border-border px-3 text-xs text-text hover:text-title">Filtrer</button>
      </form>
      <p className="mt-3 text-xs text-text">{visibles.length} événement{visibles.length > 1 ? "s" : ""}{mode === "emails" ? " · emails reçus et envoyés, dédoublonnés entre les boîtes" : mode === "appels" ? " · appels Aircall (métadonnées) et appels notés à la main" : ""}</p>
      {visibles.length === 0 ? <p className="mt-3 text-sm text-text">Rien sur cette période.</p> : (
        <ol className="mt-4 space-y-3 border-l border-border pl-5">
          {visibles.map((e) => {
            const call = isAircallMeta(e.meta) ? e.meta : null, mail = isGmailMeta(e.meta) ? e.meta : null;
            return (
              <li key={e.id} className="relative">
                <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-bg", e.canal === "email" ? "bg-blue" : e.canal === "appel" ? "bg-green" : e.canal === "rdv" ? "bg-violet" : e.canal === "contrat" ? "bg-yellow" : e.canal === "note" ? "bg-pink" : "bg-text")} />
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-text">
                  <span className="font-semibold text-text-strong">{e.href ? <Link href={e.href} className="hover:underline">{e.titre}</Link> : e.titre}</span>
                  <span>{fmtDayTime(e.date)}</span>
                  {e.auteur && <span>· {e.auteur}</span>}
                  {e.contact && <span>· {e.contact}</span>}
                  <span className="rounded-full border border-border px-1.5 text-[10px]">{CANAL_LABEL[e.canal]}</span>
                </div>
                {e.texte && !call && !mail && <p className="mt-1 text-sm whitespace-pre-line text-text-strong">{e.texte.length > 600 ? e.texte.slice(0, 600) + "…" : e.texte}</p>}
                {call && e.echangeId && <AircallBloc echangeId={e.echangeId} m={call} />}
                {mail && <GmailBloc m={mail} />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
