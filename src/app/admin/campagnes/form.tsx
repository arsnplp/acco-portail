"use client";

import { useActionState, useState } from "react";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { creerCampagne, modifierCampagne, type CampState } from "./actions";

type Modele = { key: string; titre: string; objet: string; corps: string };
export type CampagneInit = { id?: string; titre: string; objet: string; corpsHtml: string; commercial: boolean; plafond: number };

export function CampagneForm({ init, modeles, commerciaux, clientIds, variables }: { init: CampagneInit; modeles: Modele[]; commerciaux: { id: string; name: string }[]; clientIds?: string; variables: string[] }) {
  const [titre, setTitre] = useState(init.titre), [objet, setObjet] = useState(init.objet), [corps, setCorps] = useState(init.corpsHtml);
  const [state, action] = useActionState<CampState, FormData>(init.id ? modifierCampagne.bind(null, init.id) : creerCampagne, {});
  const choisir = (k: string) => { const m = modeles.find((x) => x.key === k); if (!m) return; if (!titre) setTitre(m.titre); setObjet(m.objet); setCorps(m.corps); };
  return (
    <form action={action} className="space-y-4">
      {clientIds && <input type="hidden" name="clientIds" value={clientIds} />}
      {!init.id && <Field label="Partir d’un modèle"><Select value="" onChange={(e) => choisir(e.target.value)}><option value="">—</option>{modeles.map((m) => <option key={m.key} value={m.key}>{m.titre}</option>)}</Select></Field>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre interne"><Input name="titre" required value={titre} onChange={(e) => setTitre(e.target.value)} /></Field>
        <Field label="Plafond de destinataires (par envoi)"><Input name="plafond" inputMode="numeric" defaultValue={String(init.plafond)} /></Field>
      </div>
      <Field label="Objet de l’email"><Input name="objet" required value={objet} onChange={(e) => setObjet(e.target.value)} /></Field>
      <Field label="Contenu HTML" hint={`Variables : ${variables.map((v) => `{{${v}}}`).join(" ")} · images Canva : balise <img> avec un lien public`}><Textarea name="corpsHtml" required value={corps} onChange={(e) => setCorps(e.target.value)} className="min-h-48 font-mono text-xs" /></Field>
      <label className="flex items-center gap-2 text-sm text-text-strong"><input type="checkbox" name="commercial" value="on" defaultChecked={init.commercial} className="size-4" /> Message commercial (ligne de désinscription ajoutée, contacts désinscrits exclus). Décochez pour un message de service.</label>
      {!init.id && !clientIds && (
        <div className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2">
          <Field label="Cible"><Select name="cible" defaultValue="tous"><option value="tous">Tous les clients actifs</option><option value="en_ligne">Clients avec un site en ligne</option><option value="sans_contact">Sans échange depuis 60 jours (sans RDV prévu)</option></Select></Field>
          <Field label="Commercial référent"><Select name="commercialId" defaultValue=""><option value="">Tous</option>{commerciaux.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <p className="text-xs text-text sm:col-span-2">Pour une sélection fine, partez du tableau Clients (filtres, cases à cocher, action « Envoyer un email »).</p>
        </div>
      )}
      {init.id && <label className="flex items-center gap-2 text-xs text-text"><input type="checkbox" name="recibler" className="size-4" /> Recalculer les destinataires avec la cible ci-dessous <Select name="cible" defaultValue="tous" className="ml-2 py-1 text-xs"><option value="tous">Tous</option><option value="en_ligne">Site en ligne</option><option value="sans_contact">Sans contact 60 j</option></Select></label>}
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
      <SubmitButton pendingLabel="…">{init.id ? "Enregistrer le brouillon" : "Créer la campagne (brouillon)"}</SubmitButton>
    </form>
  );
}
