/** Filtres à choix multiples : dans l'URL, les valeurs cochées sont jointes par des virgules (`?c=id1,id2`). Vide = tout. */
export const multi = (v?: string | null): string[] => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
/** Remplace, ajoute ou retire une valeur dans une liste (puces-liens qui se cochent et se décochent). */
export const bascule = (liste: string[], v: string) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);
