"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { StarIcon } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { LogoClient } from "@/components/ui/logo-client";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { actionGroupee, sauverVue, supprimerVue, type ActionState } from "./actions";

export type Ligne = {
  id: string; name: string; logo: string | null; secteur: string | null; reference: boolean; formule: string | null; referent: string | null; dev: string | null;
  sites: { name: string; statut: string; tone: Tone }[]; dernierContact: string | null; joursSansContact: number | null; rdvAVenir: boolean; echeance: string | null; mensuel: string | null;
  demandes: number; docs: number; impaye: boolean; taches: number;
};
type Membre = { id: string; name: string };
export type Vue = { id: string; nom: string; params: Record<string, string> };

/** Grille du portefeuille (3.2) : vignette logo, colonnes, sélection et actions groupées avec prévisualisation. */
export function GrilleClients({ lignes, membres, vues, params, droits }: { lignes: Ligne[]; membres: Membre[]; vues: Vue[]; params: Record<string, string>; droits: { attribuer: boolean; archiver: boolean; finance: boolean; externe: boolean } }) {
  const [sel, setSel] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [state, formAction] = useActionState<ActionState & { ok?: string }, FormData>(actionGroupee, {});
  const [vueState, vueAction] = useActionState<ActionState, FormData>(sauverVue, {});
  const tous = sel.length === lignes.length && lignes.length > 0;
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const choisis = lignes.filter((l) => sel.includes(l.id));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {vues.map((v) => <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Link href={`/admin/clients?${new URLSearchParams(v.params)}`} className="text-title hover:underline">{v.nom}</Link><form action={supprimerVue.bind(null, v.id)}><button type="submit" aria-label="Supprimer la vue" className="text-muted hover:text-pink">×</button></form></span>)}
        <form action={vueAction} className="inline-flex items-center gap-1"><input type="hidden" name="params" value={JSON.stringify(params)} /><Input name="nom" placeholder="Enregistrer cette vue…" className="h-8 w-44 py-0 text-xs" /><SubmitButton size="sm" variant="ghost" pendingLabel="…" className="h-8 px-2 text-xs">Enregistrer</SubmitButton><FormError message={vueState.error} /></form>
        <a href={`/admin/clients/export${sel.length ? `?ids=${sel.join(",")}` : ""}`} className="ml-auto rounded-full border border-border px-2.5 py-1 text-title hover:border-text">Exporter CSV {sel.length ? `(${sel.length})` : "(tout)"}</a>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] tracking-wide text-text uppercase">
            <th className="px-2 py-2"><input type="checkbox" checked={tous} onChange={() => setSel(tous ? [] : lignes.map((l) => l.id))} aria-label="Tout sélectionner" className="size-4" /></th>
            <th className="px-2 py-2 font-semibold">Client</th><th className="px-2 py-2 font-semibold">Référent</th><th className="px-2 py-2 font-semibold">Formule</th><th className="px-2 py-2 font-semibold">Sites</th><th className="px-2 py-2 font-semibold">Dernier contact</th><th className="px-2 py-2 font-semibold">Échéance</th>{droits.finance && <th className="px-2 py-2 text-right font-semibold">Mensuel</th>}<th className="px-2 py-2 font-semibold">À traiter</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {lignes.map((l) => (
              <tr key={l.id} className={cn(sel.includes(l.id) && "bg-surface-2")}>
                <td className="px-2 py-2"><input type="checkbox" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} aria-label={l.name} className="size-4" /></td>
                <td className="px-2 py-2"><Link href={`/admin/clients/${l.id}`} className="flex items-center gap-2"><LogoClient id={l.id} name={l.name} logo={l.logo} size={32} /><span className="min-w-0"><span className="flex items-center gap-1 font-semibold text-title">{l.reference && <StarIcon size={12} className="fill-yellow text-yellow" aria-label="Client référence" />}{l.name}</span><span className="block truncate text-xs text-text">{l.secteur ?? "—"}{l.dev ? ` · dev ${l.dev}` : ""}</span></span></Link></td>
                <td className="px-2 py-2 text-xs text-text-strong">{l.referent ?? <span className="text-pink">personne</span>}</td>
                <td className="px-2 py-2 text-xs">{l.formule ? <Badge tone="blue">{l.formule}</Badge> : "—"}</td>
                <td className="px-2 py-2 text-xs"><span className="flex flex-wrap gap-1">{l.sites.map((s) => <Badge key={s.name} tone={s.tone}>{s.name}</Badge>)}{l.sites.length === 0 && <span className="text-text">aucun</span>}</span></td>
                <td className={cn("px-2 py-2 text-xs", l.joursSansContact !== null && l.joursSansContact >= 60 && !l.rdvAVenir ? "font-semibold text-pink" : "text-text")}>{l.dernierContact ? `${l.dernierContact} (${l.joursSansContact} j)` : "aucun"}{l.rdvAVenir ? " · RDV prévu" : ""}</td>
                <td className="px-2 py-2 text-xs text-text">{l.echeance ?? "—"}</td>
                {droits.finance && <td className="px-2 py-2 text-right text-xs tabular-nums text-text-strong">{l.mensuel ?? "—"}</td>}
                <td className="px-2 py-2 text-xs"><span className="flex flex-wrap gap-1">{l.impaye && <Badge tone="pink">impayé</Badge>}{l.demandes > 0 && <Badge tone="yellow">{l.demandes} demande{l.demandes > 1 ? "s" : ""}</Badge>}{l.docs > 0 && <Badge tone="yellow">{l.docs} doc{l.docs > 1 ? "s" : ""}</Badge>}{l.taches > 0 && <Badge tone="neutral">{l.taches} tâche{l.taches > 1 ? "s" : ""}</Badge>}</span></td>
              </tr>
            ))}
            {lignes.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-text">Aucun client avec ces filtres.</td></tr>}
          </tbody>
        </table>
      </div>

      {sel.length > 0 && !droits.externe && (
        <form action={formAction} className="sticky bottom-3 mt-3 space-y-2 rounded-card border border-border bg-bg/95 p-3 shadow-2xl shadow-black/40 backdrop-blur">
          <input type="hidden" name="ids" value={sel.join(",")} />
          <div className="flex flex-wrap items-end gap-2">
            <p className="text-sm font-semibold text-title">{sel.length} client{sel.length > 1 ? "s" : ""} sélectionné{sel.length > 1 ? "s" : ""}</p>
            <Field label="Action"><Select name="action" value={action} onChange={(e) => setAction(e.target.value)} className="py-1.5 text-sm"><option value="">Choisir…</option><option value="email">Envoyer un email (campagne à valider)</option><option value="appels">Campagne d’appels (une tâche par client)</option><option value="rdv">Demander un rendez-vous (tâche par client)</option>{droits.attribuer && <option value="reattribuer">Réattribuer le référent</option>}<option value="etiquette">Étiqueter (secteur)</option>{droits.archiver && <option value="archiver">Archiver</option>}</Select></Field>
            {action === "appels" && <><Field label="Titre de l’appel"><Input name="titre" placeholder="Prendre des nouvelles…" /></Field><Field label="Échéance"><Input name="echeance" type="date" /></Field><Field label="Responsable"><Select name="responsableId" defaultValue=""><option value="">Référent de chaque client</option>{membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field></>}
            {action === "reattribuer" && <Field label="Nouveau référent"><Select name="commercialId" defaultValue=""><option value="">Personne</option>{membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>}
            {action === "etiquette" && <Field label="Secteur"><Input name="secteur" required /></Field>}
            <SubmitButton size="sm" pendingLabel="…" disabled={!action}>{action === "email" ? "Préparer la campagne" : "Appliquer"}</SubmitButton>
          </div>
          <p className="text-xs text-text">Prévisualisation : {choisis.slice(0, 8).map((c) => c.name).join(", ")}{choisis.length > 8 ? ` et ${choisis.length - 8} autre${choisis.length - 8 > 1 ? "s" : ""}` : ""}. {action === "email" ? "Les contacts désinscrits seront exclus ; rien ne part sans validation humaine." : "Chaque action est journalisée sur la fiche de chaque client."}</p>
          <FormError message={state.error} />
          {state.ok && <p className="text-xs text-green">{state.ok}</p>}
        </form>
      )}
    </div>
  );
}
