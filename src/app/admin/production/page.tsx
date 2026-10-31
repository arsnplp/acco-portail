import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { SectionTitle } from "@/components/ui/card";
import { PROJECT_STEPS } from "@/lib/labels";
import { fmtDayTime, teamName } from "@/lib/crm";
import { ActivityIcon } from "lucide-react";
import { ProductionBoard, type SiteCard } from "./board";

export const metadata = { title: "Production" };

/**
 * Module Suivi → Production : kanban « Sites en cours » (6 étapes, échéances sur les cartes, développeur attitré),
 * suivi des articles de blog (publié / non publié), flux d'activité global de l'agence.
 */
export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ dev?: string }> }) {
  const me = await requireTeam();
  const { dev } = await searchParams;
  const [sites, equipe, activites] = await Promise.all([
    prisma.site.findMany({
      where: { status: "EN_CREATION" },
      orderBy: [{ etapeAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, projectStep: true, etapeAt: true, createdAt: true, previewUrl: true, developpeurId: true, deadlineV1: true, deadlineV2: true, deadlineLivraison: true, client: { select: { id: true, name: true } }, developpeur: { select: { firstName: true, email: true } }, _count: { select: { changeRequests: { where: { status: { not: "TERMINEE" } } } } } },
    }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "DEV", "EXPERT", "SPECIALISTE", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, role: true } }),
    prisma.activite.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { firstName: true, email: true } } } }),
  ]);
  const cards: SiteCard[] = sites.map((s) => {
    const step = PROJECT_STEPS.find((p) => p.key === s.projectStep)!;
    const deadline = s[step.deadline];
    return {
      id: s.id, name: s.name, client: s.client.name, clientId: s.client.id, etape: s.projectStep, developpeurId: s.developpeurId, dev: s.developpeur ? teamName(s.developpeur) : null,
      deadline: deadline?.toISOString() ?? null, deadlineLabel: step.deadline === "deadlineV1" ? "V1" : step.deadline === "deadlineV2" ? "V2" : "Livraison",
      depuis: (s.etapeAt ?? s.createdAt).toISOString(), modifs: s._count.changeRequests, preview: s.previewUrl,
    };
  });
  const devs = equipe.filter((u) => u.role !== "COMMERCIAL").map((u) => ({ id: u.id, name: teamName(u) }));

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Production</h1>
          <p className="mt-1 text-sm text-text">{cards.length} site{cards.length > 1 ? "s" : ""} en cours · glissez une carte pour changer d’étape (vers « Livré » en bas pour mettre en ligne), cliquez pour ouvrir le site.</p>
        </div>
      </div>
      <ProductionBoard initial={cards} devs={devs} meId={me.id} initialDev={dev ?? "all"} />

      <div className="max-w-3xl">
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
      </div>
    </main>
  );
}
