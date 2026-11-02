"use client";

import { useActionState, useMemo, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { creerContrat, modifierContrat, type ContratState } from "./actions";

export type OffreChoix = { id: string; name: string; billing: "MENSUEL" | "PONCTUEL"; prix: number; setup: number; parentName: string | null };
export type LigneForm = { offerId: string | null; libelle: string; billing: "MENSUEL" | "PONCTUEL"; montantHt: number; siteId: string | null; quantite: number };
export type ContratInit = {
  id?: string; titre: string; formule: string | null; moyenPaiement: string | null; dureeMois: number; reconductionMois: number; preavisJours: number; debutEngagement: string; siteId: string | null; lignes: LigneForm[];
};
const euros = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const FORMULES = ["ESSENTIEL", "REFERENCE", "CONQUETE", "SIGNATURE"];
const MOYENS: Array<[string, string]> = [["SEPA", "Prélèvement SEPA"], ["CARTE", "Carte bancaire (lien Stripe)"], ["VIREMENT", "Virement"], ["LIEN", "Lien de paiement"], ["AUTRE", "Autre"]];

/**
 * Générateur commun (5.1) : même formulaire pour un prospect (Prospection) et un client existant (Suivi).
 * Lignes de prestation depuis le catalogue (prix non rétroactifs : le montant est copié) ou libres, ciblées sur un site.
 */
export function ContratForm({ init, offres, sites, prospectId, clientId, pour }: { init: ContratInit; offres: OffreChoix[]; sites: { id: string; name: string }[]; prospectId?: string | null; clientId?: string | null; pour: string }) {
  const [lignes, setLignes] = useState<LigneForm[]>(init.lignes);
  const [debut, setDebut] = useState(init.debutEngagement);
  const [duree, setDuree] = useState(init.dureeMois);
  const action = init.id ? modifierContrat.bind(null, init.id) : creerContrat;
  const [state, formAction] = useActionState<ContratState, FormData>(action, {});
  const mensuel = lignes.filter((l) => l.billing === "MENSUEL").reduce((a, l) => a + l.montantHt * l.quantite, 0);
  const ponctuel = lignes.filter((l) => l.billing === "PONCTUEL").reduce((a, l) => a + l.montantHt * l.quantite, 0);
  const fin = useMemo(() => { if (!debut || !duree) return ""; const d = new Date(`${debut}T12:00:00`); d.setMonth(d.getMonth() + duree); return d.toLocaleDateString("fr-FR"); }, [debut, duree]);
  const remise = lignes.some((l) => { const o = offres.find((x) => x.id === l.offerId); return o && l.montantHt < o.prix; });
  const maj = (i: number, patch: Partial<LigneForm>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const ajouterOffre = (id: string) => {
    const o = offres.find((x) => x.id === id); if (!o) return;
    const siteId = sites.length === 1 ? sites[0].id : null;
    setLignes((ls) => [...ls, { offerId: o.id, libelle: o.name, billing: o.billing, montantHt: o.prix, siteId, quantite: 1 }, ...(o.billing === "MENSUEL" && o.setup ? [{ offerId: o.id, libelle: `${o.name} : mise en place`, billing: "PONCTUEL" as const, montantHt: o.setup, siteId, quantite: 1 }] : [])]);
  };
  return (
    <form action={formAction} className="space-y-5">
      {prospectId && <input type="hidden" name="prospectId" value={prospectId} />}
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      <input type="hidden" name="lignes" value={JSON.stringify(lignes)} />
      <p className="text-sm text-text">Contrat pour <span className="font-semibold text-text-strong">{pour}</span>.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre du contrat"><Input name="titre" required defaultValue={init.titre} placeholder="Site vitrine + maintenance" /></Field>
        <Field label="Formule"><Select name="formule" defaultValue={init.formule ?? ""}><option value="">—</option>{FORMULES.map((f) => <option key={f} value={f}>{f}</option>)}</Select></Field>
        {sites.length > 0 && <Field label="Site concerné (référence)"><Select name="siteId" defaultValue={init.siteId ?? ""}><option value="">— nouveau site / non précisé</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
        <Field label="Moyen de paiement"><Select name="moyenPaiement" defaultValue={init.moyenPaiement ?? ""}><option value="">À convenir</option>{MOYENS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      </div>

      <section className="rounded-card border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-title">Lignes de prestation</p>
          <div className="flex items-center gap-2">
            <Select value="" onChange={(e) => ajouterOffre(e.target.value)} className="py-1.5 text-xs" aria-label="Ajouter depuis le catalogue"><option value="">+ Depuis le catalogue…</option>{offres.map((o) => <option key={o.id} value={o.id}>{o.name}{o.parentName ? ` (complément de ${o.parentName})` : ""} · {euros(o.prix)}{o.billing === "MENSUEL" ? " / mois" : ""}</option>)}</Select>
            <button type="button" onClick={() => setLignes((ls) => [...ls, { offerId: null, libelle: "", billing: "PONCTUEL", montantHt: 0, siteId: sites.length === 1 ? sites[0].id : null, quantite: 1 }])} className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs text-title hover:border-text"><PlusIcon size={13} /> Ligne libre</button>
          </div>
        </div>
        {lignes.length === 0 && <p className="mt-2 text-xs text-text">Aucune ligne. Ajoutez une offre du catalogue ou une ligne libre (devis, prestation spécifique).</p>}
        <ul className="mt-3 space-y-2">
          {lignes.map((l, i) => (
            <li key={i} className="grid gap-2 rounded-card border border-border p-2 sm:grid-cols-[1fr_110px_120px_70px_150px_36px] sm:items-center">
              <Input value={l.libelle} onChange={(e) => maj(i, { libelle: e.target.value })} placeholder="Libellé" required className="py-1.5 text-sm" />
              <Select value={l.billing} onChange={(e) => maj(i, { billing: e.target.value as "MENSUEL" | "PONCTUEL" })} className="py-1.5 text-sm"><option value="MENSUEL">Mensuel</option><option value="PONCTUEL">Ponctuel</option></Select>
              <Input inputMode="decimal" value={(l.montantHt / 100).toString()} onChange={(e) => maj(i, { montantHt: Math.round((parseFloat(e.target.value.replace(",", ".")) || 0) * 100) })} aria-label="Montant HT" className="py-1.5 text-sm" />
              <Input inputMode="numeric" value={String(l.quantite)} onChange={(e) => maj(i, { quantite: Math.max(1, parseInt(e.target.value, 10) || 1) })} aria-label="Quantité" className="py-1.5 text-sm" />
              <Select value={l.siteId ?? ""} onChange={(e) => maj(i, { siteId: e.target.value || null })} className="py-1.5 text-sm" aria-label="Site"><option value="">Tous / nouveau site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              <button type="button" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} aria-label="Retirer" className="flex size-9 items-center justify-center rounded-full text-text hover:text-pink"><Trash2Icon size={14} /></button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-text-strong">Total : <span className="font-semibold">{euros(mensuel)} HT / mois</span>{ponctuel ? <> + <span className="font-semibold">{euros(ponctuel)} HT</span> ponctuel</> : null}</p>
        {remise && <p className="mt-1 text-xs text-yellow">Un prix est inférieur au catalogue : exception tarifaire à valider par Bilel ou Lucas avant envoi.</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Début d’engagement"><Input name="debutEngagement" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></Field>
        <Field label="Durée (mois)"><Input name="dureeMois" inputMode="numeric" value={String(duree)} onChange={(e) => setDuree(parseInt(e.target.value, 10) || 0)} /></Field>
        <Field label="Reconduction (mois)"><Input name="reconductionMois" inputMode="numeric" defaultValue={String(init.reconductionMois)} /></Field>
        <Field label="Préavis (jours)"><Input name="preavisJours" inputMode="numeric" defaultValue={String(init.preavisJours)} /></Field>
      </div>
      {fin && <p className="-mt-2 text-xs text-text">Fin d’engagement calculée : {fin}. Clauses type : engagement 24 mois, reconduction tacite 24 mois, préavis 30 jours par courrier recommandé (à faire valider juridiquement).</p>}
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
      <SubmitButton pendingLabel="Enregistrement…">{init.id ? "Enregistrer le brouillon" : "Créer le contrat (brouillon)"}</SubmitButton>
    </form>
  );
}
