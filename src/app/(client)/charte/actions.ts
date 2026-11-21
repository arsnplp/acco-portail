"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClientContext } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { chargerCharte, nettoyerCharte, PIECE_KINDS } from "@/lib/charte";
import { notifyAdmins } from "@/lib/notify";
import { logActivite } from "@/lib/activite";

export type CharteState = { error?: string; ok?: string };

const TYPES_OK = /^(image\/(png|jpeg|webp|svg\+xml|gif|avif)|application\/pdf|font\/.*|application\/(x-font-.*|vnd\.ms-fontobject|font-woff2?))$/;
const EXT_OK = /\.(png|jpe?g|webp|svg|gif|avif|pdf|ttf|otf|woff2?|eot|ai|eps)$/i;

/** Enregistre la charte (JSON nettoyé). Tous les membres du portail du client peuvent la remplir. */
export async function saveCharte(_prev: CharteState, fd: FormData): Promise<CharteState> {
  const { client, user } = await requireClientContext();
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get("contenu") ?? "{}")); } catch { return { error: "Formulaire illisible, réessayez." }; }
  const contenu = nettoyerCharte(raw);
  await prisma.charte.upsert({ where: { clientId: client.id }, create: { clientId: client.id, contenu }, update: { contenu } });
  await logActivite({ kind: "charte", texte: "Charte graphique mise à jour par le client", href: `/admin/clients/${client.id}?onglet=charte`, userId: user.id, clientId: client.id });
  revalidatePath("/charte"); revalidatePath("/"); revalidatePath("/compte"); revalidatePath(`/admin/clients/${client.id}`);
  return { ok: "Enregistré. Merci !" };
}

/** Dépose un fichier (logo, police, inspiration, autre) dans la charte. Un logo image devient aussi le logo du compte s'il n'y en a pas. */
export async function uploadPieceCharte(kind: string, _prev: CharteState, fd: FormData): Promise<CharteState> {
  const { client } = await requireClientContext();
  if (!(kind in PIECE_KINDS)) return { error: "Type inconnu." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  if (file.size > 25 * 1024 * 1024) return { error: "Fichier trop lourd (25 Mo max)." };
  if (!TYPES_OK.test(file.type) && !EXT_OK.test(file.name)) return { error: "Format non pris en charge : image, PDF ou fichier de police." };
  const charte = await chargerCharte(client.id);
  try {
    const storagePath = await uploadFile("site-assets", `charte/${client.id}`, file);
    await prisma.chartePiece.create({ data: { charteId: charte.id, kind, storagePath, fileName: file.name, contentType: file.type || null, sizeBytes: file.size } });
    if (kind === "logo" && !client.logoPath && /^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      const { enregistrerLogo } = await import("@/lib/logo");
      await enregistrerLogo(client.id, file).catch(() => null);
    }
  } catch (e) { return { error: (e as Error).message }; }
  after(() => notifyAdmins({ pref: "documents", tag: `charte-${charte.id}`, href: `/admin/clients/${client.id}?onglet=charte`, title: `Charte graphique · ${client.name}`, body: `${PIECE_KINDS[kind]} déposé : ${file.name}` }));
  revalidatePath("/charte"); revalidatePath("/compte"); revalidatePath(`/admin/clients/${client.id}`);
  return { ok: "Fichier reçu." };
}

export async function supprimerPieceCharte(id: string) {
  const { client } = await requireClientContext();
  await prisma.chartePiece.deleteMany({ where: { id, charte: { clientId: client.id } } });
  revalidatePath("/charte"); revalidatePath(`/admin/clients/${client.id}`);
}
