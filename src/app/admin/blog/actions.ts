"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { requireSiteAcces } from "@/lib/perimetre";
import { planifierArticle, proposerSujet, publierArticle, redigerArticle, titreExiste } from "@/lib/blog";

export type BlogState = { error?: string; ok?: string };
const raf = (siteId: string) => { revalidatePath(`/admin/blog/${siteId}`); revalidatePath("/admin/blog"); revalidatePath(`/admin/sites/${siteId}`); revalidatePath(`/sites/${siteId}/blog`); };

async function siteDe(articleId: string) { return (await prisma.article.findUnique({ where: { id: articleId }, select: { siteId: true } }))?.siteId ?? null; }

export async function demanderArticle(siteId: string, _prev: BlogState, fd: FormData): Promise<BlogState> {
  const me = await requireTeam(); await requireSiteAcces(me, siteId);
  const titre = String(fd.get("titre") ?? "").trim().slice(0, 160);
  if (!titre) return { error: "Donnez un sujet." };
  if (await titreExiste(siteId, titre)) return { error: "Ce sujet existe déjà pour ce site (doublon)." };
  await prisma.article.create({ data: { siteId, titre, consignes: String(fd.get("consignes") ?? "").trim() || null, auteurId: me.id } });
  raf(siteId); return { ok: "Ajouté aux blogs demandés." };
}
export async function redigerAction(articleId: string): Promise<BlogState> {
  const me = await requireTeam(); const siteId = await siteDe(articleId); if (!siteId) return { error: "Introuvable." }; await requireSiteAcces(me, siteId);
  const r = await redigerArticle(articleId, me.id); raf(siteId);
  return r.ok ? { ok: "Rédigé." } : { error: r.error };
}
export async function planifierAction(articleId: string): Promise<BlogState> {
  const me = await requireTeam(); const siteId = await siteDe(articleId); if (!siteId) return { error: "Introuvable." }; await requireSiteAcces(me, siteId);
  const r = await planifierArticle(articleId, me.id); raf(siteId);
  return r.ok ? { ok: `Prévu pour ${r.lundi.toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}.` } : { error: r.error };
}
export async function publierAction(articleId: string, _prev: BlogState, fd: FormData): Promise<BlogState> {
  const me = await requireTeam(); const siteId = await siteDe(articleId); if (!siteId) return { error: "Introuvable." }; await requireSiteAcces(me, siteId);
  const url = String(fd.get("url") ?? "").trim();
  if (url && !/^https?:\/\//.test(url)) return { error: "L’adresse doit commencer par https://" };
  await publierArticle(articleId, url || null, me.id); raf(siteId);
  return { ok: "Publié." };
}
export async function proposerSujetAction(siteId: string): Promise<BlogState> {
  const me = await requireTeam(); await requireSiteAcces(me, siteId);
  const r = await proposerSujet(siteId, me.id); raf(siteId);
  return r.ok ? { ok: `Sujet proposé : ${r.titre}` } : { error: r.error };
}
export async function setBlogAuto(siteId: string, on: boolean) {
  const me = await requireTeam(); await requireSiteAcces(me, siteId);
  await prisma.site.update({ where: { id: siteId }, data: { blogAuto: on } }); raf(siteId);
}
export async function deplanifierAction(articleId: string) {
  const me = await requireTeam(); const siteId = await siteDe(articleId); if (!siteId) return; await requireSiteAcces(me, siteId);
  await prisma.article.updateMany({ where: { id: articleId, statut: "A_PUBLIER" }, data: { statut: "REDIGE", prevuPour: null } }); raf(siteId);
}
export async function supprimerArticleAction(articleId: string) {
  const me = await requireTeam(); const siteId = await siteDe(articleId); if (!siteId) return; await requireSiteAcces(me, siteId);
  await prisma.article.deleteMany({ where: { id: articleId, statut: { not: "PUBLIE" } } }); raf(siteId);
}
