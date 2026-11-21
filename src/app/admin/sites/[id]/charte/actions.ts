"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { requireSiteAcces } from "@/lib/perimetre";
import { estExterne } from "@/lib/permissions";
import { uploadFile } from "@/lib/storage";
import { chargerCharte, nettoyerCharte, PIECE_KINDS } from "@/lib/charte";
import { logActivite } from "@/lib/activite";
import { notifyClient } from "@/lib/notify";

export type CharteState = { error?: string; ok?: string };
const revalider = (siteId: string) => { revalidatePath(`/admin/sites/${siteId}/charte`); revalidatePath(`/admin/sites/${siteId}`); revalidatePath(`/sites/${siteId}`, "layout"); };

/** L'équipe enregistre la charte du site (JSON nettoyé). */
export async function saveCharteSite(siteId: string, _prev: CharteState, fd: FormData): Promise<CharteState> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get("contenu") ?? "{}")); } catch { return { error: "Formulaire illisible." }; }
  const contenu = nettoyerCharte(raw);
  await prisma.charte.upsert({ where: { siteId }, create: { siteId, contenu }, update: { contenu } });
  revalider(siteId);
  return { ok: "Enregistré." };
}

/** Publier : la charte devient visible du client (onglet « Votre DA ») ; le client est prévenu. Dépublier la masque. */
export async function publierCharteSite(siteId: string, visible: boolean): Promise<CharteState> {
  const me = await requireTeam();
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  await requireSiteAcces(me, siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { clientId: true, name: true, charte: { select: { publieeAt: true } } } });
  if (!site) return { error: "Site introuvable." };
  await prisma.charte.upsert({ where: { siteId }, create: { siteId, publieeAt: visible ? new Date() : null }, update: { publieeAt: visible ? new Date() : null } });
  if (visible && !site.charte?.publieeAt) {
    await notifyClient({ clientId: site.clientId, siteId, kind: "DOCUMENT_DISPONIBLE", pref: "documents", title: `Votre DA est disponible · ${site.name}`, body: "Couleurs, polices, logo : retrouvez la charte graphique de votre site dans votre espace.", href: `/sites/${siteId}/da` });
    await logActivite({ kind: "charte", texte: `Charte graphique publiée pour ${site.name}`, href: `/admin/sites/${siteId}/charte`, userId: me.id, clientId: site.clientId, siteId });
  }
  revalider(siteId);
  return { ok: visible ? "Publiée : le client la voit dans « Votre DA »." : "Masquée au client." };
}

const EXT_OK = /\.(png|jpe?g|webp|svg|gif|avif|pdf|ttf|otf|woff2?|eot|ai|eps|zip)$/i;

export async function deposerPieceCharte(siteId: string, kind: string, _prev: CharteState, fd: FormData): Promise<CharteState> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  if (!(kind in PIECE_KINDS)) return { error: "Type inconnu." };
  const fichiers = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length === 0) return { error: "Choisissez au moins un fichier." };
  const charte = await chargerCharte(siteId);
  let n = 0;
  for (const file of fichiers) {
    if (!EXT_OK.test(file.name)) return { error: `${file.name} : format non pris en charge.` };
    try {
      const storagePath = await uploadFile("site-assets", `charte/${siteId}`, file);
      await prisma.chartePiece.create({ data: { charteId: charte.id, kind, storagePath, fileName: file.name, contentType: file.type || null, sizeBytes: file.size } });
      n++;
    } catch (e) { return { error: `${file.name} : ${(e as Error).message}` }; }
  }
  revalider(siteId);
  return { ok: `${n} fichier${n > 1 ? "s" : ""} déposé${n > 1 ? "s" : ""}.` };
}

export async function supprimerPieceCharte(siteId: string, id: string) {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  await prisma.chartePiece.deleteMany({ where: { id, charte: { siteId } } });
  revalider(siteId);
}
