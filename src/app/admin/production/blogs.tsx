"use client";

import { useActionState, useState, useTransition } from "react";
import type { ArticleStatut } from "@prisma/client";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Input, Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ARTICLE_STATUT } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { addArticle, deleteArticle, setArticleStatut, type ActionState } from "../sites/actions";

const STATUTS = Object.keys(ARTICLE_STATUT) as ArticleStatut[];
const CLS: Record<ArticleStatut, string> = { A_REDIGER: "text-text", A_PUBLIER: "text-yellow", PUBLIE: "text-green" };

export function ArticleForm({ sites, siteId }: { sites?: { id: string; name: string }[]; siteId?: string }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await addArticle(prev, fd); if (r.ok) setKey((k) => k + 1); return r; }, {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text-strong hover:border-text"><PlusIcon size={14} /> Ajouter un article</button>;
  return (
    <form key={key} action={action} className={cn("grid gap-2 rounded-card border border-border bg-surface p-3", siteId ? "sm:grid-cols-[2fr_1fr]" : "sm:grid-cols-[1fr_1fr_auto]")}>
      {siteId ? <input type="hidden" name="siteId" value={siteId} /> : <Select name="siteId" required className="py-2 text-sm"><option value="">Site…</option>{(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
      <Input name="titre" required placeholder="Titre de l’article" className="py-2 text-sm" />
      <Select name="statut" defaultValue="A_REDIGER" className="py-2 text-sm">{STATUTS.map((s) => <option key={s} value={s}>{ARTICLE_STATUT[s].label}</option>)}</Select>
      <Input name="url" type="url" placeholder="URL une fois publié (optionnel)" className="py-2 text-sm sm:col-span-2" />
      <div className="flex gap-2"><SubmitButton size="sm" pendingLabel="Ajout…">Ajouter</SubmitButton><button type="button" onClick={() => setOpen(false)} className="px-2 text-sm text-text hover:text-title">Fermer</button></div>
      {state.error && <div className="sm:col-span-3"><FormError message={state.error} /></div>}
    </form>
  );
}

export function ArticleStatutSelect({ id, statut }: { id: string; statut: ArticleStatut }) {
  const [pending, start] = useTransition();
  return (
    <select value={statut} disabled={pending} onChange={(e) => start(() => setArticleStatut(id, e.target.value as ArticleStatut))} aria-label="État de l’article" className={cn("rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold disabled:opacity-60", CLS[statut])}>
      {STATUTS.map((s) => <option key={s} value={s}>{ARTICLE_STATUT[s].label}</option>)}
    </select>
  );
}

export function DeleteArticleButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm("Retirer cet article du suivi ?") && start(() => deleteArticle(id))} aria-label="Supprimer" className="text-muted hover:text-pink disabled:opacity-50"><Trash2Icon size={13} /></button>;
}
