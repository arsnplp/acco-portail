"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarCheckIcon, SparklesIcon } from "lucide-react";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toggle } from "@/components/ui/toggle";
import { demanderArticle, deplanifierAction, planifierAction, proposerSujetAction, publierAction, publierMaintenantAction, redigerAction, setBlogAuto, supprimerArticleAction, type BlogState } from "./actions";

function useBouton(fn: () => Promise<BlogState>) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<BlogState>({});
  return { pending, msg, run: () => start(async () => setMsg(await fn())) };
}
const B = "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold disabled:opacity-50";

export function RedigerButton({ id }: { id: string }) {
  const { pending, msg, run } = useBouton(() => redigerAction(id));
  return <span><button type="button" disabled={pending} onClick={run} className={`${B} border-border text-title hover:border-text`}><SparklesIcon size={13} /> {pending ? "Rédaction…" : "Rédiger"}</button>{msg.error && <span className="ml-2 text-xs text-pink">{msg.error}</span>}</span>;
}
export function PlanifierButton({ id }: { id: string }) {
  const { pending, msg, run } = useBouton(() => planifierAction(id));
  return <span><button type="button" disabled={pending} onClick={run} className={`${B} border-transparent bg-title text-bg`}><CalendarCheckIcon size={13} /> {pending ? "…" : "Prévoir lundi prochain"}</button>{msg.error && <span className="ml-2 text-xs text-pink">{msg.error}</span>}{msg.ok && <span className="ml-2 text-xs text-green">{msg.ok}</span>}</span>;
}
export function DeplanifierButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => deplanifierAction(id))} className="text-xs text-text hover:text-title disabled:opacity-50">Retirer du planning</button>;
}
export function SupprimerButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Retirer cet article ?") && start(() => supprimerArticleAction(id))} className="text-xs text-text hover:text-pink disabled:opacity-50">Retirer</button>;
}
export function PublierForm({ id, url }: { id: string; url: string | null }) {
  const [state, action] = useActionState<BlogState, FormData>(publierAction.bind(null, id), {});
  return <form action={action} className="flex flex-wrap items-end gap-2"><Field label="Adresse de l’article publié"><Input name="url" type="url" defaultValue={url ?? ""} placeholder="https://…" className="py-1.5 text-sm" /></Field><SubmitButton size="sm" pendingLabel="…">Marquer publié</SubmitButton><FormError message={state.error} /></form>;
}
export function ProposerSujetButton({ siteId }: { siteId: string }) {
  const { pending, msg, run } = useBouton(() => proposerSujetAction(siteId));
  return <span><button type="button" disabled={pending} onClick={run} className={`${B} border-border text-title hover:border-text`}><SparklesIcon size={13} /> {pending ? "…" : "Proposer un sujet (IA)"}</button>{msg.error && <span className="ml-2 text-xs text-pink">{msg.error}</span>}{msg.ok && <span className="ml-2 text-xs text-green">{msg.ok}</span>}</span>;
}
export function DemanderForm({ siteId }: { siteId: string }) {
  const [key, setKey] = useState(0);
  const [state, action] = useActionState<BlogState, FormData>(async (p, fd) => { const r = await demanderArticle(siteId, p, fd); if (r.ok) setKey((k) => k + 1); return r; }, {});
  return (
    <form key={key} action={action} className="space-y-2 rounded-card border border-border bg-surface p-3">
      <Input name="titre" required placeholder="Sujet ou titre de l’article" className="py-1.5 text-sm" />
      <Textarea name="consignes" placeholder="Consignes (facultatif)" className="min-h-12 text-sm" />
      <div className="flex items-center gap-3"><SubmitButton size="sm" variant="secondary" pendingLabel="…">Ajouter aux blogs demandés</SubmitButton><FormError message={state.error} />{state.ok && <span className="text-xs text-green">{state.ok}</span>}</div>
    </form>
  );
}
export function AutoForm({ siteId, on }: { siteId: string; on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <form onChange={(e) => { const cb = e.target as unknown as HTMLInputElement; if (cb.name === "auto") start(() => setBlogAuto(siteId, cb.checked)); }} className={`rounded-card border border-border bg-surface ${pending ? "opacity-60" : ""}`}>
      <Toggle name="auto" label="Automatique : chaque semaine, rédige le prochain blog demandé (ou un sujet proposé) et le prévoit pour le lundi suivant. Il reste à publier par le développeur." defaultChecked={on} />
    </form>
  );
}

export function PublierMaintenantButton({ id }: { id: string }) {
  const { pending, msg, run } = useBouton(() => publierMaintenantAction(id));
  return <span><button type="button" disabled={pending} onClick={() => confirm("Publier maintenant via Claude (dépôt GitHub du site) ?") && run()} className={`${B} border-claude/50 text-claude`}>{pending ? "…" : "Publier maintenant (Claude)"}</button>{msg.error && <span className="ml-2 text-xs text-pink">{msg.error}</span>}{msg.ok && <span className="ml-2 text-xs text-green">{msg.ok}</span>}</span>;
}
