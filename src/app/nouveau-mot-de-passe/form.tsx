"use client";

import { useActionState, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { setPassword, type NewPasswordState } from "./actions";
import { Button } from "@/components/ui/button";

export function NewPasswordForm({ next = "/", compact = false }: { next?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(setPassword, {});
  const [show, setShow] = useState(false);
  const field = "flex items-center gap-3 rounded-card border border-border bg-surface px-4 focus-within:border-blue transition-colors";
  const input = `w-full bg-transparent ${compact ? "py-3" : "py-4"} text-base text-title placeholder:text-muted outline-none`;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm text-text-strong">Nouveau mot de passe</span>
        <div className={`mt-2 ${field}`}><Lock size={18} strokeWidth={1.75} className="text-text" /><input type={show ? "text" : "password"} name="password" autoComplete="new-password" required minLength={8} className={input} /><button type="button" onClick={() => setShow(!show)} aria-label="Afficher" className="text-text">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        <span className="mt-1.5 block text-xs text-muted">8 caractères minimum, avec des lettres et au moins un chiffre.</span>
      </label>
      <label className="block">
        <span className="text-sm text-text-strong">Confirmez-le</span>
        <div className={`mt-2 ${field}`}><Lock size={18} strokeWidth={1.75} className="text-text" /><input type={show ? "text" : "password"} name="confirm" autoComplete="new-password" required minLength={8} className={input} /></div>
      </label>
      {state.error && <p className="text-sm text-pink">{state.error}</p>}
      <Button type="submit" size={compact ? "md" : "lg"} className="w-full" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le mot de passe"}</Button>
    </form>
  );
}
