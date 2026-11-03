import { NewspaperIcon } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ARTICLE_STATUT } from "@/lib/labels";
import { fmtDateShort } from "@/lib/format";
import { commanderArticle } from "../actions";

export const metadata = { title: "Blog" };

/** Blog (14.4) : commande d'article avec titre, consignes et option de relecture ; historique des articles. */
export default async function BlogClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const articles = await prisma.article.findMany({ where: { siteId: site.id }, orderBy: [{ statut: "asc" }, { updatedAt: "desc" }] });
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
