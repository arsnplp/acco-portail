/**
 * Registre officiel des entreprises (API Recherche d'entreprises de l'État, gratuite, sans clé) :
 * SIREN, SIRET, dirigeant, forme juridique, NAF, date de création, état, établissements.
 */
import { similarity } from "./texte";

const API = "https://recherche-entreprises.api.gouv.fr/search";

const NATURE: Record<string, string> = {
  "1000": "Entrepreneur individuel", "5498": "EURL", "5499": "SARL", "5710": "SAS", "5720": "SASU", "5202": "SNC",
  "5308": "SCA", "5306": "SCS", "5599": "SA", "5785": "SELAS", "5385": "SELARL", "6540": "SCI", "6599": "Société civile", "9220": "Association",
};

type Dirigeant = { type_dirigeant?: string; nom?: string; prenoms?: string; qualite?: string; denomination?: string };
type Etab = { siret?: string; code_postal?: string; commune?: string; adresse?: string; liste_enseignes?: string[] | null; etat_administratif?: string };
type Result = {
  siren: string; nom_complet?: string; nom_raison_sociale?: string; nom?: string; nature_juridique?: string; activite_principale?: string;
  date_creation?: string; etat_administratif?: string; nombre_etablissements?: number; nombre_etablissements_ouverts?: number;
  siege?: Etab; dirigeants?: Dirigeant[]; matching_etablissements?: Etab[];
};

export type Registre = {
  siren: string; siret: string | null; nom: string; dirigeant: string | null; role: string | null; forme: string | null; naf: string | null;
  creation: string | null; etat: string | null; etabTotal: number | null; etabOuverts: number | null; fiabilite: number; tva: string;
};

async function search(params: Record<string, string>) {
  const res = await fetch(`${API}?${new URLSearchParams({ per_page: "5", ...params })}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 1200)); return search(params); }
  if (!res.ok) return [] as Result[];
  const json = (await res.json()) as { results?: Result[]; resultats?: Result[] };
  return json.results ?? json.resultats ?? [];
}

/** Numéro de TVA intracommunautaire français, calculé depuis le SIREN. */
export const tvaFromSiren = (siren: string) => `FR${String((12 + 3 * (Number(siren) % 97)) % 97).padStart(2, "0")}${siren}`;

export async function lookupRegistre(entreprise: string, codePostal: string | null, ville: string | null): Promise<Registre | null> {
  const attempts: Record<string, string>[] = [];
  if (codePostal) attempts.push({ q: entreprise, code_postal: codePostal });
  if (codePostal) attempts.push({ q: entreprise, departement: codePostal.slice(0, 2) });
  attempts.push({ q: `${entreprise} ${ville ?? ""}`.trim() });
  for (const params of attempts) {
    let results: Result[] = [];
    try { results = await search(params); } catch { continue; }
    let best: { r: Result; etab: Etab | null; score: number } | null = null;
    for (const r of results) {
      const etab = r.matching_etablissements?.find((e) => !codePostal || e.code_postal === codePostal) ?? (r.siege?.code_postal === codePostal ? r.siege : null) ?? r.siege ?? null;
      const names = [r.nom_complet, r.nom_raison_sociale, r.nom, ...(etab?.liste_enseignes ?? [])].filter(Boolean) as string[];
      const nameScore = Math.max(0, ...names.map((n) => similarity(n, entreprise)));
      const cpOk = codePostal && etab?.code_postal === codePostal ? 1 : 0;
      const score = Math.round(nameScore * 75 + cpOk * 25);
      if (!best || score > best.score) best = { r, etab, score };
    }
    if (best && best.score >= 55) {
      const { r, etab, score } = best;
      const d = r.dirigeants?.find((x) => x.type_dirigeant !== "personne morale") ?? r.dirigeants?.[0];
      const ei = r.nature_juridique === "1000";
      return {
        siren: r.siren,
        siret: etab?.siret ?? r.siege?.siret ?? null,
        nom: r.nom_complet ?? r.nom_raison_sociale ?? r.nom ?? entreprise,
        dirigeant: d ? (d.denomination ?? [d.nom, d.prenoms].filter(Boolean).join(" ")) : ei ? (r.nom_complet ?? null) : null,
        role: d?.qualite ?? (ei ? "Entrepreneur individuel" : null),
        forme: r.nature_juridique ? NATURE[r.nature_juridique] ?? `Code ${r.nature_juridique}` : null,
        naf: r.activite_principale ?? null,
        creation: r.date_creation ?? null,
        etat: r.etat_administratif ?? null,
        etabTotal: r.nombre_etablissements ?? null,
        etabOuverts: r.nombre_etablissements_ouverts ?? null,
        fiabilite: score,
        tva: tvaFromSiren(r.siren),
      };
    }
  }
  return null;
}
