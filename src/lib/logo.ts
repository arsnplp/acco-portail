/**
 * Logo des clients (00.1) : dépôt manuel (PNG, JPG, SVG, WebP), recadrage carré et miniature 128 px générés une fois côté
 * serveur, stockage privé dans le bucket « documents » (dossier logos/<clientId>). Aucun service externe.
 */
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };
const MAX = 5 * 1024 * 1024;
const CONTENT_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" };

async function recadrer(bytes: Buffer, taille: number) {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bytes).rotate().resize(taille, taille, { fit: "cover", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  } catch (e) {
    console.warn("[logo] miniature impossible, original conservé :", (e as Error).message);
    return null;
  }
}

/** Dépose le logo d'un client (par l'équipe ou depuis le portail) et remplace l'ancien. */
export async function enregistrerLogo(clientId: string, file: File) {
  const ext = LOGO_TYPES[file.type];
  if (!ext) throw new Error("Format accepté : PNG, JPG, SVG ou WebP.");
  if (file.size === 0) throw new Error("Fichier vide.");
  if (file.size > MAX) throw new Error("Logo trop lourd (5 Mo max).");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (ext === "svg") {
    const txt = bytes.toString("utf8");
    if (/<script|on[a-z]+\s*=|javascript:|<foreignObject|<iframe|<embed|<object|xlink:href\s*=\s*["']?\s*(?!#|data:image)/i.test(txt)) throw new Error("SVG refusé : il contient du script ou des références externes.");
  }
  const storage = createSupabaseAdmin().storage.from("documents");
  const stamp = Date.now();
  let logoPath: string, logoMiniPath: string;
  if (ext === "svg") {
    logoPath = `logos/${clientId}/${stamp}.svg`; logoMiniPath = logoPath;
    const { error } = await storage.upload(logoPath, bytes, { contentType: "image/svg+xml", upsert: true });
    if (error) throw new Error(error.message);
  } else {
    const [grand, mini] = await Promise.all([recadrer(bytes, 512), recadrer(bytes, 128)]);
    logoPath = `logos/${clientId}/${stamp}.${grand ? "webp" : ext}`;
    logoMiniPath = mini ? `logos/${clientId}/${stamp}-mini.webp` : logoPath;
    const r1 = await storage.upload(logoPath, grand ?? bytes, { contentType: grand ? "image/webp" : file.type, upsert: true });
    if (r1.error) throw new Error(r1.error.message);
    if (mini) { const r2 = await storage.upload(logoMiniPath, mini, { contentType: "image/webp", upsert: true }); if (r2.error) throw new Error(r2.error.message); }
  }
  const avant = await prisma.client.findUnique({ where: { id: clientId }, select: { logoPath: true, logoMiniPath: true } });
  await prisma.client.update({ where: { id: clientId }, data: { logoPath, logoMiniPath } });
  const anciens = [avant?.logoPath, avant?.logoMiniPath].filter((p): p is string => !!p && p !== logoPath && p !== logoMiniPath);
  if (anciens.length) await storage.remove(anciens).catch(() => null);
  return { logoPath, logoMiniPath };
}

export async function supprimerLogo(clientId: string) {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { logoPath: true, logoMiniPath: true } });
  const paths = [c?.logoPath, c?.logoMiniPath].filter((p): p is string => !!p);
  await prisma.client.update({ where: { id: clientId }, data: { logoPath: null, logoMiniPath: null } });
  if (paths.length) await createSupabaseAdmin().storage.from("documents").remove([...new Set(paths)]).catch(() => null);
}

/** Octets du logo (miniature par défaut) pour la route /api/logo. */
export async function lireLogo(clientId: string, mini: boolean) {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { logoPath: true, logoMiniPath: true } });
  const path = (mini ? c?.logoMiniPath : c?.logoPath) ?? c?.logoPath;
  if (!path) return null;
  const { data, error } = await createSupabaseAdmin().storage.from("documents").download(path);
  if (error || !data) return null;
  const ext = path.split(".").pop() ?? "webp";
  return { bytes: Buffer.from(await data.arrayBuffer()), contentType: CONTENT_TYPE[ext] ?? "application/octet-stream" };
}
