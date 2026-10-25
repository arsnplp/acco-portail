import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, MapPinIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { fmtDayTime, teamName } from "@/lib/crm";
import { COLONNES, COLONNES_PRINCIPALES, LISTE_STATUT, ficheGoogle, type Colonne, type LeadRow } from "@/lib/leads/colonnes";
import { DeleteLeadButton, ListActions } from "../forms";
import { StatsPanel } from "../stats-panel";
import { listeStats } from "@/lib/leads/stats";

export const metadata = { title: "Liste de leads" };

const scoreCls = (s: number) => (s >= 85 ? "bg-green/20 text-green" : s >= 70 ? "bg-yellow/20 text-yellow" : "bg-surface-2 text-text");

export default async function LeadListePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tout?: string }> }) {
  const me = await requireTeam();
  const { id } = await params;
  const tout = (await searchParams).tout === "1";
  const [liste, team] = await Promise.all([
    prisma.leadListe.findUnique({ where: { id }, include: { leads: { orderBy: [{ score: "desc" }, { createdAt: "asc" }] }, auteur: { select: { firstName: true, email: true } } } }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
  ]);
  if (!liste) notFound();
  const stats = (await listeStats([liste.id])).get(liste.id)!;
  const filtres = [liste.mobileSeul ? "mobiles uniquement" : null, liste.filtreSite === "SANS" ? "sans site" : liste.filtreSite === "AVEC" ? "avec site" : null].filter(Boolean);
  const cols: Colonne[] = tout ? [...COLONNES] : COLONNES_PRINCIPALES;
  const restants = liste.leads.filter((l) => !l.prospectId).length;
  const st = LISTE_STATUT[liste.statut];
  const show = (c: Colonne, v: unknown, d?: LeadRow) => {
    if (c === "Fiche Google" && d) {
      const f = ficheGoogle(d);
      return f ? <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-blue hover:underline" title={f.exacte ? "Fiche Google" : "Recherche Google Maps (nom + adresse)"}><MapPinIcon size={12} aria-hidden />{f.exacte ? "Voir la fiche" : "Voir sur Maps"}</a> : <span className="text-muted">–</span>;
    }
    if (v === null || v === undefined || v === "") return <span className="text-muted">–</span>;
    const s = String(v);
    if ((c === "Site web" || c === "Facebook" || c === "Instagram") && /^https?:/.test(s)) return <a href={s} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue hover:underline">{c === "Site web" ? s.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : c}<ExternalLinkIcon size={11} /></a>;
    if (c === "Téléphone") return <a href={`tel:${s.replace(/\s/g, "")}`} className="whitespace-nowrap hover:underline">{s}</a>;
    if (c === "Score") return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", scoreCls(Number(s)))}>{s}</span>;
    if (c === "Faiblesses SEO") return <span className="block max-w-72 text-xs text-text">{s.split(" | ").join(" · ")}</span>;
    return s;
  };

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      {liste.statut === "GENERATION" && <AutoRefresh seconds={6} />}
      <Link href="/crm/leads" className="inline-flex items-center gap-1.5 text-sm text-text hover:text-title"><ArrowLeftIcon size={15} aria-hidden /> Coffre à leads</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl capitalize">{liste.secteur} · <span className="normal-case">{liste.region}</span></h1>
        <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", st.cls)}>{st.label}</span>
        {filtres.map((f) => <span key={f} className="rounded-full border border-border px-2.5 py-1 text-xs text-text-strong">{f}</span>)}
      </div>
      <p className="mt-1 text-sm text-text">
        {liste.obtenus} lead{liste.obtenus > 1 ? "s" : ""} sur {liste.demande} demandés · générée {fmtDayTime(liste.createdAt)}{liste.auteur ? ` par ${teamName(liste.auteur)}` : ""}
        {liste.recherches ? ` · ${liste.recherches} recherches web` : ""}{liste.coutUsd ? ` · coût ≈ ${liste.coutUsd.toFixed(2)} $` : ""}
        {liste.utiliseeAt ? ` · envoyée dans À contacter ${fmtDayTime(liste.utiliseeAt)}` : ""}
      </p>
      {liste.message && <p className={cn("mt-3 rounded-card border px-4 py-2.5 text-sm", liste.statut === "ERREUR" ? "border-pink/40 bg-pink/10 text-pink" : liste.obtenus < liste.demande ? "border-yellow/40 bg-yellow/10 text-yellow" : "border-green/40 bg-green/10 text-green")}>{liste.message}</p>}
      {liste.statut === "ERREUR" && liste.erreur && <p className="mt-2 rounded-card border border-border bg-surface px-4 py-2.5 font-mono text-xs break-all text-text">Détail : {liste.erreur}</p>}
      {liste.statut === "GENERATION" && <p className="mt-3 rounded-card border border-yellow/40 bg-yellow/10 px-4 py-2.5 text-sm text-yellow">Recherche en cours (2 à 5 minutes). La page se met à jour toute seule.</p>}

      {liste.statut !== "GENERATION" && <div className="mt-4"><StatsPanel s={stats} /></div>}

      <div className="mt-4">
        <ListActions id={liste.id} statut={liste.statut} restants={restants} commercialId={liste.commercialId} team={team.map((u) => ({ id: u.id, name: teamName(u) }))} meId={me.id} isAdmin={me.role === "ADMIN"} canDelete={me.role === "ADMIN" || liste.auteurId === me.id} />
      </div>

      {liste.leads.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-text">Triés par score (besoin d’un site + réputation Google + entreprise active).</p>
            <Link href={tout ? `/crm/leads/${id}` : `/crm/leads/${id}?tout=1`} className="text-xs text-text-strong underline">{tout ? "Colonnes principales" : `Toutes les colonnes (${COLONNES.length})`}</Link>
          </div>
          <div className="mt-2 overflow-x-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-text">
                <tr>{cols.map((c) => <th key={c} className="px-3 py-2.5 font-medium whitespace-nowrap">{c}</th>)}<th className="px-3 py-2.5 font-medium">CRM</th><th /></tr>
              </thead>
              <tbody>
                {liste.leads.map((l) => {
                  const d = l.donnees as LeadRow;
                  return (
                    <tr key={l.id} className="border-t border-border align-top hover:bg-surface/60">
                      {cols.map((c) => <td key={c} className={cn("px-3 py-2.5", c === "Entreprise" ? "font-semibold whitespace-nowrap text-title" : c === "Faiblesses SEO" ? "min-w-56 text-text-strong" : "whitespace-nowrap text-text-strong")}>{show(c, d[c], d)}</td>)}
                      <td className="px-3 py-2.5 whitespace-nowrap">{l.prospectId ? <Link href={`/crm/prospects/${l.prospectId}`} className="text-xs text-green hover:underline">Dans le CRM</Link> : <span className="text-xs text-muted">Pas encore</span>}</td>
                      <td className="px-3 py-2.5">{!l.prospectId && <DeleteLeadButton id={l.id} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
