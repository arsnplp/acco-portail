"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendIcon, Trash2Icon, RotateCwIcon } from "lucide-react";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignLeadList, createLeadList, deleteLead, deleteLeadList, retryLeadList, sendListToProspects, type LeadState } from "./actions";

export function GenerateForm({ team, meId, isAdmin }: { team: { id: string; name: string }[]; meId: string; isAdmin: boolean }) {
  const [state, action] = useActionState<LeadState, FormData>(createLeadList, {});
  const [n, setN] = useState(20);
  return (
    <form action={action} className="space-y-4 rounded-card border border-border bg-surface p-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between"><span className="text-sm font-medium text-text-strong">Nombre de leads</span><span className="font-title text-2xl font-extrabold tabular-nums text-title">{n}</span></div>
        <input type="range" name="nombre" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-white" aria-label="Nombre de leads (1 à 50)" />
        <div className="flex justify-between text-[11px] text-muted"><span>1</span><span>25</span><span>50</span></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Secteur d’activité"><Input name="secteur" required minLength={3} placeholder="esthéticienne, auto-école, coach sportif…" /></Field>
        <Field label="Région ou villes"><Input name="region" required minLength={3} placeholder="Aix-en-Provence et Marseille" /></Field>
      </div>
      <Field label="Attribuer la liste à">
        <Select name="commercialId" defaultValue="">
          <option value="">Personne pour l’instant</option>
          {(isAdmin ? team : team.filter((u) => u.id === meId)).map((u) => <option key={u.id} value={u.id}>{u.id === meId ? `Moi (${u.name})` : u.name}</option>)}
        </Select>
      </Field>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
      <SubmitButton className="w-full" pendingLabel="Lancement…">Générer la liste</SubmitButton>
      <p className="text-xs text-muted">Recherche sur le web (fiches Google, Planity, Pages Jaunes…), vérification au registre officiel des entreprises et audit du site. Les entreprises déjà dans le CRM, le portail ou le coffre sont écartées.</p>
    </form>
  );
}

export function ListActions({ id, statut, restants, commercialId, team, meId, isAdmin, canDelete }: { id: string; statut: string; restants: number; commercialId: string | null; team: { id: string; name: string }[]; meId: string; isAdmin: boolean; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<LeadState>({});
  const router = useRouter();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {restants > 0 && statut !== "GENERATION" && (
          <button type="button" disabled={pending} onClick={() => confirm(`Envoyer ${restants} lead${restants > 1 ? "s" : ""} dans « À contacter » ?`) && start(async () => { setMsg(await sendListToProspects(id)); router.refresh(); })}
            className="flex h-10 items-center gap-2 rounded-card bg-title px-4 text-sm font-semibold text-bg hover:bg-text-strong disabled:opacity-50">
            <SendIcon size={15} aria-hidden /> {pending ? "Envoi…" : `Envoyer ${restants} lead${restants > 1 ? "s" : ""} dans À contacter`}
          </button>
        )}
        {statut === "ERREUR" && <button type="button" disabled={pending} onClick={() => start(() => retryLeadList(id))} className="flex h-10 items-center gap-2 rounded-card border border-border px-4 text-sm text-title hover:border-text"><RotateCwIcon size={15} aria-hidden /> Relancer la génération</button>}
        <select value={commercialId ?? ""} disabled={pending || (!isAdmin && !!commercialId && commercialId !== meId)} onChange={(e) => start(() => assignLeadList(id, e.target.value || null))} aria-label="Attribuer la liste" className="h-10 rounded-card border border-border bg-surface px-3 text-sm text-text-strong">
          <option value="">Non attribuée</option>
          {(isAdmin ? team : team.filter((u) => u.id === meId || u.id === commercialId)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <a href={`/crm/leads/${id}/export`} className="flex h-10 items-center rounded-card border border-border px-4 text-sm text-title hover:border-text">Télécharger (Excel)</a>
        {canDelete && <button type="button" disabled={pending} onClick={() => confirm("Supprimer cette liste du coffre ? Les prospects déjà envoyés restent dans le CRM.") && start(async () => { await deleteLeadList(id); router.push("/crm/leads"); })} className="ml-auto flex h-10 items-center gap-1.5 px-2 text-sm text-text hover:text-pink"><Trash2Icon size={14} aria-hidden /> Supprimer</button>}
      </div>
      {msg.ok && <p className="text-sm text-green">{msg.ok}</p>}
      <FormError message={msg.error} />
    </div>
  );
}

export function DeleteLeadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => deleteLead(id))} aria-label="Retirer ce lead de la liste" className="text-muted hover:text-pink disabled:opacity-50"><Trash2Icon size={14} /></button>;
}
