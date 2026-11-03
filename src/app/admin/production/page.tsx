import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { SectionTitle } from "@/components/ui/card";
import { PROJECT_STEPS } from "@/lib/labels";
import { fmtDayTime, teamName } from "@/lib/crm";
import { daysUntil } from "@/lib/format";
import { ActivityIcon } from "lucide-react";
import { ProductionBoard, type SiteCard } from "./board";
import { whereSitesPour } from "@/lib/perimetre";
import { estExterne } from "@/lib/permissions";
import { etatProduction } from "@/lib/production";

export const metadata = { title: "Production" };

/**
 * Module Suivi → Production : kanban « Sites en cours » (6 étapes, échéances sur les cartes, développeur attitré),
 * suivi des articles de blog (publié / non publié), flux d'activité global de l'agence.
 */
export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ dev?: string }> }) {
  const me = await requireTeam();
  const { dev } = await searchParams;
  const externe = estExterne(me);
  const [sites, equipe, activites, validations, modifsOuvertes] = await Promise.all([
    prisma.site.findMany({
      where: { status: "EN_CREATION", ...whereSitesPour(me) },
      orderBy: [{ etapeAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, projectStep: true, etapeAt: true, createdAt: true, previewUrl: true, developpeurId: true, version: true, deadlineV1: true, deadlineV2: true, deadlineLivraison: true, client: { select: { id: true, name: true, logoMiniPath: true } }, developpeur: { select: { firstName: true, email: true } }, _count: { select: { changeRequests: { where: { status: { not: "TERMINEE" } } } } } },
    }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "DEV", "EXPERT", "SPECIALISTE", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, role: true } }),
    externe ? [] : prisma.activite.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { firstName: true, email: true } } } }),
    externe ? [] : prisma.validation.findMany({ where: { statut: "EN_ATTENTE", type: { in: ["MAQUETTE", "BRIEF_TECHNIQUE", "BRIEF_COMMERCIAL", "GO_LIVE"] } }, include: { site: { select: { id: true, name: true } }, assigne: { select: { firstName: true, email: true } } } }),
    prisma.changeRequest.count({ where: { status: { in: ["RECUE", "EN_COURS", "A_VALIDER"] }, site: { status: "EN_LIGNE", ...whereSitesPour(me) } } }),
  ]);
  const etats = await Promise.all(sites.map((s) => etatProduction(s.id)));
  const cards: SiteCard[] = sites.map((s, i) => {
    const step = PROJECT_STEPS.find((p) => p.key === s.projectStep)!;
    const deadline = s[step.deadline];
    const e = etats[i];
    return {
      id: s.id, name: s.name, client: s.client.name, clientId: s.client.id, logo: s.client.logoMiniPath, etape: s.projectStep, developpeurId: s.developpeurId, dev: s.developpeur ? teamName(s.developpeur) : null,
      deadline: deadline?.toISOString() ?? null, deadlineLabel: step.deadline === "deadlineV1" ? "V1" : step.deadline === "deadlineV2" ? "V2" : "Livraison",
      depuis: (s.etapeAt ?? s.createdAt).toISOString(), modifs: s._count.changeRequests, preview: s.previewUrl, version: s.version, blocages: e.blocages, actions: e.actions, docsManquants: e.docsManquants.length,
    };
  });
  // Tableau de bord production (2.4) : projets par étape, validations en attente, charge par développeur, bloqués, échéances.
  const parEtape = PROJECT_STEPS.map((p) => ({ label: p.label, n: cards.filter((c) => c.etape === p.key).length }));
  const bloques = cards.filter((c) => c.blocages.length > 0).length;
  const enRetard = cards.filter((c) => c.deadline && daysUntil(c.deadline) < 0).length;
  const charge = equipe.filter((u) => u.role !== "COMMERCIAL").map((u) => ({ nom: teamName(u), n: cards.filter((c) => c.developpeurId === u.id).length })).filter((x) => x.n > 0);
  const sansDev = cards.filter((c) => !c.developpeurId).length;
  const devs = equipe.filter((u) => u.role !== "COMMERCIAL").map((u) => ({ id: u.id, name: teamName(u) }));

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Production</h1>
          <p className="mt-1 text-sm text-text">{cards.length} site{cards.length > 1 ? "s" : ""} en cours · glissez une carte pour changer d’étape (vers « Livré » en bas pour mettre en ligne), cliquez pour ouvrir le site.</p>
        </div>
      </div>
      {!externe && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Tuile titre="Par étape" lignes={parEtape.map((p) => `${p.label} : ${p.n}`)} />
          <Tuile titre="Validations en attente" lignes={validations.length === 0 ? ["Aucune"] : validations.slice(0, 5).map((v) => `${v.type === "MAQUETTE" ? "Maquette" : v.type === "GO_LIVE" ? "Mise en ligne" : v.type === "BRIEF_TECHNIQUE" ? "Brief (technique)" : "Brief (commercial)"} · ${v.site?.name ?? ""} → ${teamName(v.assigne)}`)} href="/admin/validations" />
          <Tuile titre="Charge par développeur" lignes={[...charge.map((c) => `${c.nom} : ${c.n} site${c.n > 1 ? "s" : ""}`), ...(sansDev ? [`Sans développeur : ${sansDev}`] : [])].slice(0, 6)} />
          <Tuile titre="Alertes" lignes={[`${bloques} bloqué${bloques > 1 ? "s" : ""} (paiement, brief, documents)`, `${enRetard} en retard sur l’échéance`, `${modifsOuvertes} modification${modifsOuvertes > 1 ? "s" : ""} après livraison à traiter`]} href="/admin/modifications" />
        </div>
      )}
      <ProductionBoard initial={cards} devs={devs} meId={me.id} initialDev={dev ?? "all"} />

      {!externe && <div className="max-w-3xl">
        <section>
          <SectionTitle icon={ActivityIcon}>Flux d’activité</SectionTitle>
          {activites.length === 0 ? <p className="text-sm text-text">Le flux se remplit au fil des actions : étapes franchies, modifications traitées, articles publiés, comptes rendus.</p> : (
            <ol className="space-y-2 border-l border-border pl-4">
              {activites.map((a) => (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute top-2 -left-[21px] size-2 rounded-full bg-blue" />
                  {a.href ? <Link href={a.href} className="text-text-strong hover:underline">{a.texte}</Link> : <span className="text-text-strong">{a.texte}</span>}
                  <p className="text-xs text-text">{fmtDayTime(a.createdAt)}{a.user ? ` · ${teamName(a.user)}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>}
    </main>
  );
}

function Tuile({ titre, lignes, href }: { titre: string; lignes: string[]; href?: string }) {
  const inner = <><p className="text-xs font-semibold tracking-wide text-text uppercase">{titre}</p><ul className="mt-1.5 space-y-0.5 text-sm text-text-strong">{lignes.map((l, i) => <li key={i} className="truncate">{l}</li>)}</ul></>;
  return href ? <Link href={href} className="rounded-card border border-border bg-surface p-3 hover:border-text">{inner}</Link> : <div className="rounded-card border border-border bg-surface p-3">{inner}</div>;
}
