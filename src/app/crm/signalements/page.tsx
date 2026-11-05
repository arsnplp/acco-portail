import Link from "next/link";
import { CheckIcon, MegaphoneIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProspection } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { cn } from "@/lib/cn";
import { fmtDayTime, teamName } from "@/lib/crm";
import { SectionTitle } from "@/components/ui/card";

export const metadata = { title: "Signalements" };

/** Direction : toutes les demandes faites aux commerciaux sur des fiches, en cours puis faites (pour vérifier le travail). */
export default async function SignalementsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const me = await requireProspection();
  if (!can(me, "pilotage")) redirect("/crm");
  const sp = await searchParams;
  const vue = sp.v === "faits" ? "faits" : "cours";
  const include = { prospect: { select: { id: true, societe: true, commercial: { select: { firstName: true, email: true } } } }, de: { select: { firstName: true, email: true } }, vers: { select: { firstName: true, email: true } } } as const;
  const [enCours, faits, nFaits] = await Promise.all([
    prisma.signalement.findMany({ where: { traiteAt: null }, orderBy: { createdAt: "desc" }, include }),
    vue === "faits" ? prisma.signalement.findMany({ where: { traiteAt: { not: null } }, orderBy: { traiteAt: "desc" }, take: 200, include }) : [],
    prisma.signalement.count({ where: { traiteAt: { not: null } } }),
  ]);
  const items = vue === "faits" ? faits : enCours;
  const onglet = (v: string, label: string, n: number) => (
    <Link href={v === "cours" ? "/crm/signalements" : "/crm/signalements?v=faits"} className={cn("rounded-full px-3 py-1.5 text-sm", vue === v ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{label} <span className={vue === v ? "opacity-70" : "text-xs"}>{n}</span></Link>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Signalements</h1>
          <p className="mt-1 text-sm text-text">Demandes de la Direction aux commerciaux sur des fiches prospects : en cours, puis faites pour vérification.</p>
        </div>
        <div className="flex rounded-full border border-border p-0.5">{onglet("cours", "En cours", enCours.length)}{onglet("faits", "Faits", nFaits)}</div>
      </div>

      <div className="mt-6">
        <SectionTitle icon={vue === "faits" ? CheckIcon : MegaphoneIcon}>{vue === "faits" ? "Marqués comme faits" : "En attente du commercial"}</SectionTitle>
        {items.length === 0 ? <p className="text-sm text-text">{vue === "faits" ? "Aucun signalement traité pour l’instant." : "Aucune demande en cours."}</p> : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {items.map((s) => (
              <li key={s.id}>
                <Link href={`/crm/prospects/${s.prospect.id}?signalement=${s.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/60">
                  {s.traiteAt ? <CheckIcon size={18} className="mt-0.5 shrink-0 text-green" aria-hidden /> : <MegaphoneIcon size={18} className={cn("mt-0.5 shrink-0", s.luAt ? "text-yellow" : "text-pink")} aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold text-title">{s.prospect.societe}</span>
                      <span className="text-xs text-text">de {s.de ? teamName(s.de) : "la Direction"} à {s.vers ? teamName(s.vers) : s.prospect.commercial ? teamName(s.prospect.commercial) : "?"} · {fmtDayTime(s.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-text-strong">{s.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {s.traiteAt ? `Marqué fait ${fmtDayTime(s.traiteAt)} · à vérifier sur la fiche` : s.luAt ? `Vu par le commercial ${fmtDayTime(s.luAt)}` : "Pas encore vu"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
