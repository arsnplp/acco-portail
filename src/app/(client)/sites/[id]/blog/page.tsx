import { LockIcon, NewspaperIcon, SearchIcon, TrendingUpIcon, UsersIcon } from "lucide-react";
import { blogInclus } from "@/lib/blog-inclus";
import { fmtDate } from "@/lib/format";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ARTICLE_STATUT } from "@/lib/labels";
import { fmtDateShort } from "@/lib/format";
import { commanderArticle, demanderBlog } from "../actions";

export const metadata = { title: "Blog" };

/** Blog (14.4) : commande d'article avec titre, consignes et option de relecture ; historique des articles. */
export default async function BlogClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const [inclus, articles] = await Promise.all([blogInclus(site.id, site.clientId), prisma.article.findMany({ where: { siteId: site.id }, orderBy: [{ statut: "asc" }, { updatedAt: "desc" }] })]);
  if (!inclus) {
    const demande = await prisma.activite.findFirst({ where: { siteId: site.id, kind: "demande_blog" }, select: { createdAt: true } });
    return (
      <div>
        <div className="rounded-card border border-border bg-surface p-5">
          <span className="flex size-11 items-center justify-center rounded-full border border-border text-text"><LockIcon size={18} /></span>
          <h2 className="mt-3 text-lg font-semibold text-title">Le blog n’est pas encore dans votre formule</h2>
          <p className="mt-1 text-sm text-text">Un blog, c’est des articles réguliers sur votre métier, écrits et publiés par nous sur votre site.</p>
          <ul className="mt-3 grid gap-2 text-sm text-text-strong">
            <li className="flex items-start gap-2"><SearchIcon size={16} className="mt-0.5 shrink-0 text-blue" /> Google vous trouve sur plus de recherches : chaque article est une nouvelle porte d’entrée vers votre site.</li>
            <li className="flex items-start gap-2"><TrendingUpIcon size={16} className="mt-0.5 shrink-0 text-green" /> Vous gagnez des places dans les résultats : un site qui vit régulièrement est mieux classé.</li>
            <li className="flex items-start gap-2"><UsersIcon size={16} className="mt-0.5 shrink-0 text-yellow" /> Vous rassurez vos clients : ils voient votre savoir-faire avant de vous appeler.</li>
          </ul>
          {demande ? (
            <p className="mt-4 rounded-lg border border-green/40 bg-green/10 p-3 text-sm text-green">Demande envoyée le {fmtDate(demande.createdAt)}. On revient vers vous très vite dans Messages.</p>
          ) : (
            <form action={demanderBlog.bind(null, site.id)} className="mt-4"><SubmitButton className="w-full" pendingLabel="Envoi…">Je veux le blog sur mon site</SubmitButton><p className="mt-2 text-center text-xs text-text">Sans engagement : on vous explique le fonctionnement et le tarif, vous décidez ensuite.</p></form>
          )}
        </div>
        {articles.length > 0 && <p className="mt-4 text-xs text-text">{articles.length} article{articles.length > 1 ? "s" : ""} déjà publié{articles.length > 1 ? "s" : ""} sur votre site.</p>}
      </div>
    );
  }
  return (
    <div>
      <SectionTitle icon={NewspaperIcon}>Commander un article</SectionTitle>
      <form action={commanderArticle.bind(null, site.id)} className="space-y-3 rounded-card border border-border bg-surface p-4">
        <Field label="Sujet ou titre souhaité"><Input name="titre" required placeholder="Ex. Comment choisir son pain au levain" /></Field>
        <Field label="Consignes" hint="ce qu’il faut dire, ton, mots-clés, photos à utiliser"><Textarea name="consignes" className="min-h-20" /></Field>
        <label className="flex items-center gap-2 text-sm text-text-strong"><input type="checkbox" name="approbation" className="size-4" /> Je veux relire le texte avant publication</label>
        <SubmitButton size="sm" pendingLabel="…">Commander l’article</SubmitButton>
      </form>
      <SectionTitle>Vos articles ({articles.length})</SectionTitle>
      {articles.length === 0 ? <p className="text-sm text-text">Aucun article pour l’instant.</p> : (
        <div className="grid gap-2">
          {articles.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="truncate font-medium text-title">{a.url && a.statut === "PUBLIE" ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.titre}</a> : a.titre}</p><p className="text-xs text-text">{a.publieAt ? `Publié le ${fmtDateShort(a.publieAt)}` : `Demandé le ${fmtDateShort(a.createdAt)}`}{a.approbationClient ? " · relecture avant publication" : ""}</p></div>
              <Badge tone={ARTICLE_STATUT[a.statut].tone}>{ARTICLE_STATUT[a.statut].label}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
