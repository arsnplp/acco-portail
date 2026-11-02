/** Logo client (00.1), partie sans serveur : couleur stable dérivée de l'identifiant et initiales. */
export function couleurPour(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 48% 42%)`;
}
export function initialesDe(name: string) {
  const mots = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}
/** Adresse de la miniature servie par l'app (jamais un service externe). `v` casse le cache après un nouveau dépôt. */
export const logoSrc = (clientId: string, v?: string | null, mini = true) => `/api/logo/${clientId}?${mini ? "mini=1&" : ""}v=${encodeURIComponent(v ?? "0")}`;
