import { notFound } from "next/navigation";
import { CalendarDaysIcon, CheckCircle2Icon, InboxIcon, NewspaperIcon, PenLineIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { requireSiteAcces } from "@/lib/perimetre";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/card";
import { fmtDateShort } from "@/lib/format";
import { etatBlog, fmtLundi, problemeBlog } from "@/lib/blog";
import { ARTICLE_STATUT } from "@/lib/labels";
import { AutoForm, DemanderForm, DeplanifierButton, PlanifierButton, ProposerSujetButton, PublierForm, PublierMaintenantButton, RedigerButton, SupprimerButton } from "../boutons";

export const metadata = { title: "Blog du site" };

/** Blog d'un site : dernier lundi, prochain lundi, file « blogs demandés », rédigés à prévoir, planning, historique. */
export default async function BlogSitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const me = await requireTeam();
  const { siteId } = await params;
  await requireSiteAcces(me, siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, url: true, blogAuto: true, repoUrl: true, client: { select: { name: true } } } });
  if (!site) notFound();
  const [e, pb, planifies] = await Promise.all([etatBlog(siteId), problemeBlog(siteId), prisma.article.findMany({ where: { siteId, statut: "A_PUBLIER" }, orderBy: { prevuPour: "asc" } })]);
  const Art = ({ a, actions }: { a: { id: string; titre: string; consignes: string | null; contenu: string | null; motsCles: string | null; demandeClient: boolean; approbationClient: boolean; genereParIA: boolean; createdAt: Date; prevuPour: Date | null; url: string | null; publieAt: Date | null; changeRequestId: string | null; statut: "A_REDIGER" | "REDIGE" | "A_PUBLIER" | "PUBLIE" }; actions: React.ReactNode }) => (
    <li className="rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-semibold text-title">{a.url && a.statut === "PUBLIE" ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.titre}</a> : a.titre}</p>
        <Badge tone={ARTICLE_STATUT[a.statut].tone}>{ARTICLE_STATUT[a.statut].label}{a.prevuPour ? ` · ${fmtLundi(a.prevuPour)}` : ""}</Badge>
        {a.demandeClient && <Badge tone="violet">demande client{a.approbationClient ? " · relecture" : ""}</Badge>}
        {a.genereParIA && <Badge tone="neutral">IA</Badge>}
        {a.changeRequestId && a.statut === "A_PUBLIER" && <Badge tone="claude">publication en cours (Claude)</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-text">{a.publieAt ? `Publié le ${fmtDateShort(a.publieAt)}` : `Demandé le ${fmtDateShort(a.createdAt)}`}{a.consignes ? ` · ${a.consignes}` : ""}{a.motsCles ? ` · ${a.motsCles}` : ""}</p>
      {a.contenu && <details className="mt-2"><summary className="cursor-pointer text-xs text-text hover:text-title">Lire le texte</summary><pre className="mt-2 max-h-96 overflow-auto rounded-card border border-border bg-bg p-3 text-xs leading-relaxed whitespace-pre-wrap text-text-strong">{a.contenu}</pre></details>}
      <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>
    </li>
  );
  return (
    <AdminPage title={`Blog · ${site.name}`} back={{ href: "/admin/blog", label: "Blogs" }} wide>
      <p className="-mt-3 text-sm text-text">{site.client.name}{site.url ? ` · ${site.url}` : ""} · strictement un article par lundi, pas de doublon. {site.repoUrl ? "Publication automatique le lundi matin via Claude et le dépôt GitHub du site." : <span className="text-pink">Dépôt GitHub non renseigné sur la fiche du site : pas de publication automatique.</span>}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-card border p-4 ${e.enRetard ? "border-pink/60 bg-pink/10" : "border-border bg-surface"}`}>
          <p className="text-xs font-semibold tracking-wide text-text uppercase">Dernier lundi · {fmtLundi(e.dernierLundi)}</p>
          <p className={`mt-1 font-semibold ${e.enRetard ? "text-pink" : "text-green"}`}>{e.enRetard ? "Aucun article publié : à rattraper" : "Article publié"}</p>
          {e.dernier && <p className="text-xs text-text">Dernier publié : {e.dernier.titre}{e.dernier.publieAt ? ` (${fmtDateShort(e.dernier.publieAt)})` : ""}</p>}
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-text uppercase">Prochain lundi · {fmtLundi(e.prochainLundi)}</p>
          <p className={`mt-1 font-semibold ${e.prochain ? "text-title" : "text-yellow"}`}>{e.prochain ? e.prochain.titre : "Rien de prévu"}</p>
          {pb && <p className="text-xs text-pink">Problème de l’automatisation : {pb}</p>}
        </div>
      </div>
      <div className="mt-3"><AutoForm siteId={siteId} on={site.blogAuto} /></div>

      <SectionTitle icon={InboxIcon}>Blogs demandés ({e.demandes.length})</SectionTitle>
      <ul className="grid gap-2">{e.demandes.map((a) => <Art key={a.id} a={a} actions={<><RedigerButton id={a.id} /><SupprimerButton id={a.id} /></>} />)}{e.demandes.length === 0 && <li className="text-sm text-text">File vide.</li>}</ul>
      <div className="mt-2 flex flex-wrap items-start gap-3"><DemanderForm siteId={siteId} /><ProposerSujetButton siteId={siteId} /></div>

      <SectionTitle icon={PenLineIcon}>Rédigés, à prévoir ({e.rediges.length})</SectionTitle>
      <ul className="grid gap-2">{e.rediges.map((a) => <Art key={a.id} a={a} actions={<><PlanifierButton id={a.id} /><RedigerButton id={a.id} /><SupprimerButton id={a.id} /></>} />)}{e.rediges.length === 0 && <li className="text-sm text-text">Aucun.</li>}</ul>

      <SectionTitle icon={CalendarDaysIcon}>Prévus ({planifies.length})</SectionTitle>
      <ul className="grid gap-2">{planifies.map((a) => <Art key={a.id} a={a} actions={a.changeRequestId ? <a href="/admin/modifications" className="text-xs text-text hover:text-title">Suivre dans Modifications</a> : <><PublierMaintenantButton id={a.id} /><PublierForm id={a.id} url={a.url} /><DeplanifierButton id={a.id} /></>} />)}{planifies.length === 0 && <li className="text-sm text-text">Rien de prévu : rédigez puis « Prévoir lundi prochain ».</li>}</ul>

      <SectionTitle icon={CheckCircle2Icon}>Publiés ({e.derniersPublies.length})</SectionTitle>
      <ul className="grid gap-2">{e.derniersPublies.map((a) => <Art key={a.id} a={a} actions={null} />)}{e.derniersPublies.length === 0 && <li className="text-sm text-text"><NewspaperIcon size={14} className="mr-1 inline" aria-hidden />Aucun article publié.</li>}</ul>
    </AdminPage>
  );
}
