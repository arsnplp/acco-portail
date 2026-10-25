/** Outils de comparaison de noms (sans accents, sans formes juridiques). */
export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(sarl|sas|sasu|eurl|ei|sci|sa|snc|institut|salon|la|le|les|l|de|du|des|et)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();

/** Ressemblance de 0 à 1 entre deux noms (mots en commun + inclusion). */
export function similarity(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x))) return 0.9;
  const A = new Set(x.split(" ")), B = new Set(y.split(" "));
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(A.size, B.size);
}

export const normPhone = (s: string | null | undefined) => {
  const d = (s ?? "").replace(/[^\d+]/g, "").replace(/^\+33/, "0").replace(/^0033/, "0");
  return d.length >= 9 ? d : null;
};
export const fmtPhone = (s: string | null | undefined) => {
  const d = normPhone(s);
  return d && d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, "$1 ").trim() : s ?? null;
};
export function hostOf(url: string | null | undefined) {
  if (!url) return null;
  try { return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}
