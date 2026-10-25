import { PIPELINE, STATUT, STATUT_COULEUR, VIZ } from "@/lib/crm";
import type { ListeStats } from "@/lib/leads/stats";

const euros = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");

/** Résultats d'une liste : du lead envoyé à la signature, et où en sont les fiches. */
export function StatsPanel({ s }: { s: ListeStats }) {
  if (!s.envoyes) return <p className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-text">Les résultats apparaîtront ici dès que la liste sera envoyée dans « À contacter ».</p>;
  const etapes = [
    { label: "Envoyés", n: s.envoyes, color: VIZ.blue, rate: null as string | null },
    { label: "Appelés", n: s.contactes, color: VIZ.violet, rate: pct(s.contactes, s.envoyes) },
    { label: "Joints", n: s.joints, color: VIZ.aqua, rate: pct(s.joints, s.contactes) },
    { label: "RDV pris", n: s.rdv, color: VIZ.orange, rate: pct(s.rdv, s.joints) },
    { label: "Signés", n: s.signes, color: VIZ.green, rate: pct(s.signes, s.rdv) },
  ];
  const statuts = [...PIPELINE, "GAGNE" as const, "PERDU" as const].filter((k) => s.statuts[k]);
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-title">Résultats de la liste</h2>
        <p className="text-sm text-text">{s.appels} appel{s.appels > 1 ? "s" : ""} · {s.nrp} NRP · {s.noShow} no show · <span className="font-semibold text-title">{euros(s.ca)}</span> signés</p>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {etapes.map((e) => (
          <li key={e.label} className="rounded-card border border-border bg-surface-2 p-3">
            <div className="flex items-baseline justify-between gap-1"><span className="text-xs text-text">{e.label}</span>{e.rate && <span className="text-[11px] font-semibold text-text-strong">{e.rate}</span>}</div>
            <p className="mt-1 font-title text-2xl font-extrabold tabular-nums text-title">{e.n}</p>
            <span className="mt-2 block h-1.5 rounded-full bg-bg"><span className="block h-full rounded-full" style={{ width: `${(e.n / s.envoyes) * 100}%`, background: e.color, minWidth: e.n ? 4 : 0 }} /></span>
          </li>
        ))}
      </ol>
      <p className="mt-4 mb-1.5 text-xs text-text">Où en sont les fiches</p>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Répartition des fiches par statut">
        {statuts.map((k) => <span key={k} title={`${STATUT[k].label} : ${s.statuts[k]}`} style={{ flexGrow: s.statuts[k], background: STATUT_COULEUR[k] }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-strong">
        {statuts.map((k) => <li key={k} className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: STATUT_COULEUR[k] }} />{STATUT[k].label} <span className="tabular-nums text-text">{s.statuts[k]}</span></li>)}
      </ul>
    </section>
  );
}
