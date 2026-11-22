"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { INFOS_CLIENT_CHAMPS, type InfosClient } from "@/lib/contrat-infos";
import { DUREES, FORMULES_DETAIL, INCLUS_AUTOMATIQUE, MOYENS_PAIEMENT, articlesContrat, eurosHt, type ChoixContrat, type FormuleKey } from "@/lib/contrat-articles";
import { creerContratAssistant, type ContratState } from "../actions";

export type OptionCatalogue = { id: string; name: string; benefit: string; billing: "MENSUEL" | "PONCTUEL"; prix: number };
const ETAPES = ["Client et formule", "Prix et engagement", "Options et règlement", "Aperçu du contrat"];

/** Générateur de contrats en 4 étapes (maquette de Bilel) : tout est prérempli, on ne demande que l'essentiel. */
export function AssistantContrat({ pour, clientId, prospectId, infos, options, today }: { pour: string; clientId: string | null; prospectId: string | null; infos: InfosClient; options: OptionCatalogue[]; today: string }) {
  const [etape, setEtape] = useState(0);
  const [ci, setCi] = useState<InfosClient>(infos);
  const [formule, setFormule] = useState<FormuleKey | null>(null);
  const [duree, setDuree] = useState(24);
  const [frais, setFrais] = useState("300");
  const [mensuel, setMensuel] = useState("");
  const [moisOffert, setMoisOffert] = useState(false);
  const [choisies, setChoisies] = useState<Record<string, boolean>>({});
  const [moyen, setMoyen] = useState("SEPA");
  const [jour, setJour] = useState(11);
  const [date, setDate] = useState(today);
  const [state, action] = useActionState<ContratState, FormData>(creerContratAssistant, {});

  const choisirFormule = (k: FormuleKey) => { setFormule(k); if (!mensuel) setMensuel(String(FORMULES_DETAIL[k].mensuel / 100)); };
  const cents = (s: string) => Math.max(0, Math.round((parseFloat(s.replace(",", ".")) || 0) * 100));
  const choix: ChoixContrat = useMemo(() => ({
    formule, titre: formule ? `Formule ${FORMULES_DETAIL[formule].label}` : "Contrat de prestation",
    dureeMois: duree, frais: cents(frais), mensuel: cents(mensuel) + options.filter((o) => choisies[o.id] && o.billing === "MENSUEL").reduce((a, o) => a + o.prix, 0), moisOffert,
    options: options.filter((o) => choisies[o.id]).map((o) => ({ libelle: o.name, detail: o.benefit, montantHt: o.prix, billing: o.billing })),
    moyenPaiement: moyen, jourPrelevement: jour, dateSignature: date,
  }), [formule, duree, frais, mensuel, moisOffert, choisies, options, moyen, jour, date]);
  const manquants = INFOS_CLIENT_CHAMPS.filter((f) => f.requis && !ci[f.key].trim());
  const okEtape = [!!formule && manquants.length === 0, cents(mensuel) > 0 && !!date, true, true][etape];

  return (
    <form action={action} className="space-y-4">
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {prospectId && <input type="hidden" name="prospectId" value={prospectId} />}
      <input type="hidden" name="choix" value={JSON.stringify({ ...choix, mensuelBase: cents(mensuel), optionIds: options.filter((o) => choisies[o.id]).map((o) => o.id) })} />
      {INFOS_CLIENT_CHAMPS.map((f) => <input key={f.key} type="hidden" name={`ci_${f.key}`} value={ci[f.key]} />)}

      {/* Fil d'étapes */}
      <div className="rounded-card bg-title px-4 py-3 text-bg">
        <p className="text-[11px] uppercase tracking-wide opacity-70">Générateur de contrats · {pour}</p>
        <p className="text-sm font-semibold">Nouveau contrat · Étape {etape + 1} sur 4 · {ETAPES[etape]}</p>
        <div className="mt-2 flex gap-1">{ETAPES.map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= etape ? "bg-bg" : "bg-bg/30")} />)}</div>
      </div>

      {etape === 0 && (
        <section className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-title">Client</h2>
            <p className="mb-3 text-xs text-text">{manquants.length ? `Préremplies depuis la fiche ; ${manquants.length} champ${manquants.length > 1 ? "s" : ""} à compléter (en jaune). Reporté sur la fiche client.` : "Informations préremplies depuis la fiche client, modifiables."}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {INFOS_CLIENT_CHAMPS.map((f) => <Field key={f.key} label={f.label} hint={f.aide}><Input value={ci[f.key]} onChange={(e) => setCi({ ...ci, [f.key]: e.target.value })} className={f.requis && !ci[f.key].trim() ? "border-yellow" : undefined} /></Field>)}
            </div>
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-title">Quelle formule a été vendue ?</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(Object.keys(FORMULES_DETAIL) as FormuleKey[]).map((k) => { const f = FORMULES_DETAIL[k]; const on = formule === k; return (
                <button key={k} type="button" onClick={() => choisirFormule(k)} aria-pressed={on} className={cn("rounded-card border p-3 text-left transition-colors", on ? "border-blue bg-surface-2" : "border-border hover:border-text")}>
                  <span className="flex items-center justify-between"><span className="font-semibold text-title">{f.label}</span>{on && <CheckIcon size={16} className="text-blue" />}</span>
                  <span className="block text-xs text-text">{f.sousTitre} · {eurosHt(f.mensuel)} / mois</span>
                </button>
              ); })}
            </div>
            {formule && <p className="mt-3 text-sm text-text"><span className="font-semibold text-title">{FORMULES_DETAIL[formule].label}</span> : {FORMULES_DETAIL[formule].inclus.join(" · ")}</p>}
          </div>
        </section>
      )}

      {etape === 1 && (
        <section className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-title">Durée d’engagement</h2>
            <div className="mt-2 grid gap-1">{DUREES.map((d) => <label key={d.mois} className="flex cursor-pointer items-center gap-2 text-sm text-text-strong"><input type="radio" name="_duree" checked={duree === d.mois} onChange={() => setDuree(d.mois)} className="size-4" /> {d.label}</label>)}</div>
            <p className="mt-2 text-xs text-text">{duree ? `Le contrat sera reconduit pour une période identique de ${duree} mois, sauf résiliation dans les conditions prévues.` : "Chaque partie peut mettre fin au contrat avec un préavis d’un mois."}</p>
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Frais de lancement HT (€)"><Input inputMode="decimal" value={frais} onChange={(e) => setFrais(e.target.value)} /></Field>
              <Field label="Mensualité HT (€)"><Input inputMode="decimal" value={mensuel} onChange={(e) => setMensuel(e.target.value)} placeholder={formule ? String(FORMULES_DETAIL[formule].mensuel / 100) : ""} /></Field>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-text-strong"><input type="checkbox" checked={moisOffert} onChange={(e) => setMoisOffert(e.target.checked)} className="mt-0.5 size-4" /><span><span className="font-semibold text-title">Offrir le mois de signature</span><br /><span className="text-xs text-text">Le mois de signature ne sera pas facturé. L’engagement payant commence le mois suivant.</span></span></label>
          </div>
          <Resume choix={choix} />
        </section>
      )}

      {etape === 2 && (
        <section className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-title">Prestations complémentaires</h2>
            <p className="mb-2 text-xs text-text">On affiche uniquement les options cochées dans le contrat. Le catalogue se gère dans Admin → Offres.</p>
            <div className="grid gap-1.5">
              {options.map((o) => <label key={o.id} className="flex cursor-pointer items-start gap-2 rounded-card border border-border p-2.5 text-sm hover:border-text"><input type="checkbox" checked={!!choisies[o.id]} onChange={(e) => setChoisies({ ...choisies, [o.id]: e.target.checked })} className="mt-0.5 size-4" /><span className="flex-1"><span className="font-semibold text-title">{o.name}</span> <span className="text-text">— {o.benefit}</span></span><span className="shrink-0 text-xs text-text">{eurosHt(o.prix)}{o.billing === "MENSUEL" ? " / mois" : ""}</span></label>)}
              {options.length === 0 && <p className="text-sm text-text">Aucune option dans le catalogue.</p>}
            </div>
            <div className="mt-3 rounded-card border border-green/40 bg-green/10 p-3 text-sm"><p className="flex items-center gap-1 font-semibold text-green"><CheckIcon size={14} /> Inclus automatiquement</p><p className="mt-0.5 text-text-strong">{INCLUS_AUTOMATIQUE}</p></div>
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Mode de paiement"><Select value={moyen} onChange={(e) => setMoyen(e.target.value)}>{MOYENS_PAIEMENT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Jour mensuel"><Select value={String(jour)} onChange={(e) => setJour(parseInt(e.target.value, 10))}>{Array.from({ length: 28 }, (_, i) => i + 1).map((j) => <option key={j} value={j}>Le {j} de chaque mois</option>)}</Select></Field>
              <Field label="Date de signature"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
            <p className="mt-2 text-xs text-text">Le système calcule les échéances, évite les doublons et signale les paiements trop rapprochés. Le premier paiement se note sur la fiche du contrat.</p>
          </div>
        </section>
      )}

      {etape === 3 && (
        <section className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-title">Aperçu du contrat</h2><span className="rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-semibold text-green">Prêt à générer</span></div>
            <p className="mb-3 text-xs text-text">Voici le contenu qui sera injecté dans le contrat (articles 1 à 3). Les articles suivants viennent du modèle réglé dans Paramètres → Contrats.</p>
            <div className="rounded-card border border-border bg-bg p-4 text-sm">
              <p className="text-[10px] uppercase tracking-wide text-text">Contrat d’accompagnement digital</p>
              <p className="text-lg font-semibold text-title">{choix.titre.toUpperCase()}</p>
              <p className="mb-3 text-xs text-text">Client : {ci.nom || pour}{ci.representant ? ` · ${ci.representant}${ci.fonction ? `, ${ci.fonction}` : ""}` : ""}</p>
              {articlesContrat(choix).map(([t, corps]) => <div key={t} className="mb-3"><p className="font-semibold text-title">{t}</p><p className="whitespace-pre-line text-text-strong">{corps}</p></div>)}
            </div>
          </div>
          <Resume choix={choix} />
        </section>
      )}

      <FormError message={state.error} />
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setEtape((e) => Math.max(0, e - 1))} disabled={etape === 0} className="inline-flex h-10 items-center gap-1 rounded-card border border-border px-3 text-sm text-title disabled:opacity-40"><ChevronLeftIcon size={16} /> Retour</button>
        {etape < 3
          ? <button type="button" onClick={() => setEtape((e) => e + 1)} disabled={!okEtape} className="inline-flex h-10 items-center gap-1 rounded-card bg-title px-4 text-sm font-semibold text-bg disabled:opacity-40">Continuer <ChevronRightIcon size={16} /></button>
          : <SubmitButton pendingLabel="Génération…">Générer le contrat (PDF)</SubmitButton>}
      </div>
      {/* Espace pour que le téléphone Aircall flottant (bas droite) ne recouvre jamais les boutons. */}
      <div className="h-20" aria-hidden />
    </form>
  );
}

function Resume({ choix }: { choix: ChoixContrat }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 text-sm">
      {choix.frais > 0 && <p className="flex justify-between"><span className="text-text">Frais de lancement</span><span className="font-semibold text-title">{eurosHt(choix.frais)}</span></p>}
      <p className="flex justify-between"><span className="text-text">Abonnement mensuel</span><span className="font-semibold text-title">{eurosHt(choix.mensuel)}</span></p>
      <p className="mt-1 text-xs text-text">{choix.dureeMois ? `Engagement de ${choix.dureeMois} mois` : "Sans engagement"}{choix.moisOffert ? " · mois de signature offert" : ""}{choix.options.length ? ` · ${choix.options.length} option${choix.options.length > 1 ? "s" : ""}` : ""}</p>
    </div>
  );
}
