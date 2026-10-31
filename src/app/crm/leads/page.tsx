import Link from "next/link";
import { ArchiveIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/roles";
import { requireProspection } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { SectionTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { fmtDayTime, teamName } from "@/lib/crm";
import { DeleteListButton, GenerateForm } from "./forms";
import { listeStats } from "@/lib/leads/stats";
import { LISTE_STATUT } from "@/lib/leads/colonnes";

export const metadata = { title: "Coffre à leads" };


export default async function LeadsPage() {
  const me = await requireProspection();
  const [listes, team] = await Promise.all([
    prisma.leadListe.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { commercial: { select: { firstName: true, email: true } }, auteur: { select: { firstName: true, email: true } } } }),
    prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
  ]);
  const stats = await listeStats(listes.map((l) => l.id));
  const generating = listes.some((l) => l.statut === "GENERATION");
  const prets = listes.filter((l) => l.statut === "PRETE").reduce((a, l) => a + l.obtenus, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {generating && <AutoRefresh seconds={6} />}
      <h1 className="text-2xl">Coffre à leads</h1>
      <p className="mt-1 text-sm text-text">Générez des listes de prospects vérifiés, sans doublon avec le CRM, puis envoyez-les dans « À contacter » en un clic.{prets ? ` ${prets} lead${prets > 1 ? "s" : ""} prêt${prets > 1 ? "s" : ""} à utiliser.` : ""}</p>

      <SectionTitle icon={SparklesIcon}>Générer une liste</SectionTitle>
      <GenerateForm team={team.map((u) => ({ id: u.id, name: teamName(u) }))} meId={me.id} isAdmin={me.role === "ADMIN"} />

      <SectionTitle icon={ArchiveIcon}>Listes</SectionTitle>
      {listes.length === 0 ? <p className="text-sm text-text">Aucune liste pour l’instant.</p> : (
        <ul className="space-y-2">
          {listes.map((l) => {
            const st = LISTE_STATUT[l.statut];
            return (
              <li key={l.id} className="relative flex items-center gap-2">
                <Link href={`/crm/leads/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 hover:border-text">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-title capitalize">{l.secteur} · <span className="normal-case">{l.region}</span></p>
                      {l.mobileSeul && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text">mobiles</span>}
                      {l.filtreSite && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text">{l.filtreSite === "SANS" ? "sans site" : "avec site"}</span>}
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", st.cls)}>{l.statut === "GENERATION" && <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-yellow align-middle" />}{st.label}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text">
                      {l.statut === "GENERATION" ? `${l.demande} demandés · recherche en cours…` : `${l.obtenus} lead${l.obtenus > 1 ? "s" : ""} sur ${l.demande} demandés`}
                      {" · "}{l.commercial ? `pour ${teamName(l.commercial)}` : "non attribuée"}{" · "}{fmtDayTime(l.createdAt)}{l.auteur ? ` par ${teamName(l.auteur)}` : ""}
                    </p>
                    {(() => { const s = stats.get(l.id); return s && s.envoyes ? (
                      <p className="mt-1 text-xs text-text-strong">{s.envoyes} envoyés · {s.contactes} appelés · {s.joints} joints · {s.rdv} RDV · <span className="font-semibold text-green">{s.signes} signé{s.signes > 1 ? "s" : ""}</span>{s.ca ? ` (${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(s.ca)})` : ""}</p>
                    ) : null; })()}
                    {l.message && l.statut !== "UTILISEE" && <p className={cn("mt-1 text-xs", l.statut === "ERREUR" ? "text-pink" : l.obtenus < l.demande ? "text-yellow" : "text-text-strong")}>{l.message}</p>}
                  </div>
                  <ChevronRightIcon size={18} className="shrink-0 text-text" aria-hidden />
                </Link>
                {(me.role === "ADMIN" || l.auteurId === me.id) && <DeleteListButton id={l.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
