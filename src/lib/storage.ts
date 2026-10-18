import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type Bucket = "documents" | "site-assets" | "messages" | "change-requests";

const MAX_BYTES = 25 * 1024 * 1024;

function safeName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
}

/** Dépose un fichier dans un bucket privé. Retourne le chemin de stockage. */
export async function uploadFile(bucket: Bucket, folder: string, file: File) {
  if (file.size === 0) throw new Error("Fichier vide");
  if (file.size > MAX_BYTES) throw new Error("Fichier trop lourd (25 Mo max)");
  const path = `${folder}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await createSupabaseAdmin().storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** URL signée temporaire (1 h) pour afficher ou télécharger. */
export async function signedUrl(bucket: Bucket, path: string, expiresIn = 3600) {
  const { data } = await createSupabaseAdmin().storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
