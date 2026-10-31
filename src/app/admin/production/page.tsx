import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ARTICLE_STATUT, PROJECT_STEPS } from "@/lib/labels";
import { fmtDayTime, teamName } from "@/lib/crm";
import { timeAgo } from "@/lib/format";
import { ActivityIcon, NewspaperIcon } from "lucide-react";
import { ProductionBoard, type SiteCard } from "./board";
import { ArticleForm, ArticleStatutSelect, DeleteArticleButton } from "./blogs";

export const metadata = { title: "Production" };

/**
 * Module Suivi → Production : kanban « Sites en cours » (6 étapes, échéances sur les cartes, développeur attitré),
 * suivi des articles de blog (publié / non publié), flux d'activité global de l'agence.
 */
export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ dev?: string }> }) {
  const me = await requireTeam();
  const { dev } = await searchParams;
  const [sites, equipe, articles, activites, sitesTous] = await Promise.all([
    prisma.site.findMany({
      where: { status: "EN_CREATION" },
      orderBy: [{ etapeAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, projectStep: true, etapeAt: true, createdAt: true, previewUrl: true, developpeurId: true, deadlineV1: true, deadlineV2: true, deadlineLivraison: true, client: { select: { id: true, name: true } }, developpeur: { select: { firstName: true, email: true } }, _count: { select: { changeRequests: { where: { status: { not: "TERMINEE" } } } } } },
    }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "DEV", "EXPERT", "SPECIALISTE", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, role: true } }),
    prisma.article.findMany({ orderBy: [{ statut: "asc" }, { updatedAt: "desc" }], take: 100, include: { site: { select: { id: true, name: true, client: { select: { name: true } } } }, auteur: { select: { firstName: true, email: true } } } }),
    prisma.activite.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { user: { select: { firstName: true, email: true } } } }),
    prisma.site.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, client: { select: { name: true } } } }),
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
          <p className="mt-1 text-sm text-text">{cards.length} site{cards.length > 1 ? "s" : ""} en cours · glissez une carte pour changer d’étape, cliquez pour ouvrir le site.</p>
        </div>
      </div>
      <ProductionBoard initial={cards} devs={devs} meId={me.id} initialDev={dev ?? "all"} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle icon={NewspaperIcon}>Blogs <span className="text-sm font-normal text-text">{articles.filter((a) => a.statut === "PUBLIE").length} publié{articles.filter((a) => a.statut === "PUBLIE").length > 1 ? "s" : ""} · {articles.filter((a) => a.statut !== "PUBLIE").length} à faire</span></SectionTitle>
          <ArticleForm sites={sitesTous.map((s) => ({ id: s.id, name: `${s.name} · ${s.client.name}` }))} />
          {articles.length === 0 ? <p className="mt-3 text-sm text-text">Aucun article suivi. Ajoutez les titres prévus pour chaque site, puis changez leur état au fil de la rédaction.</p> : (
            <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
              {articles.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-title">{a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.titre}</a> : a.titre}</p>
                    <p className="truncate text-xs text-text"><Link href={`/admin/sites/${a.site.id}`} className="hover:underline">{a.site.name}</Link> · {a.site.client.name}{a.publieAt ? ` · publié ${timeAgo(a.publieAt)}` : a.auteur ? ` · ${teamName(a.auteur)}` : ""}</p>
                  </div>
                  <ArticleStatutSelect id={a.id} statut={a.statut} />
                  <DeleteArticleButton id={a.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
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
      <p className="mt-6 text-xs text-muted">États des articles : {Object.values(ARTICLE_STATUT).map((s) => s.label).join(", ")}. <Badge tone="neutral" className="align-middle">Blogs</Badge> et flux d’activité sont visibles par toute l’équipe.</p>
    </main>
  );
}
