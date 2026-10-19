"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { signInWithPassword, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";

export function LoginForm({ next = "/" }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithPassword, {});
  const [show, setShow] = useState(false);
  const field = "flex items-center gap-3 rounded-card border border-border bg-surface px-4 focus-within:border-blue transition-colors";
  const input = "w-full bg-transparent py-4 text-base text-title placeholder:text-muted outline-none";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm text-text-strong">Votre email</span>
        <div className={`mt-2 ${field}`}><Mail size={18} strokeWidth={1.75} className="text-text" /><input type="email" name="email" inputMode="email" autoComplete="email" required placeholder="vous@entreprise.fr" defaultValue={state.email} className={input} /></div>
      </label>
      <label className="block">
        <span className="text-sm text-text-strong">Mot de passe</span>
        <div className={`mt-2 ${field}`}>
          <Lock size={18} strokeWidth={1.75} className="text-text" />
          <input type={show ? "text" : "password"} name="password" autoComplete="current-password" required placeholder="••••••••" className={input} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Masquer" : "Afficher"} className="text-text">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
      </label>
      {state.error && <p className="text-sm text-pink">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</Button>
      <p className="text-center text-sm"><Link href="/mot-de-passe-oublie" className="text-text underline-offset-2 hover:text-title hover:underline">Mot de passe oublié ?</Link></p>
    </form>
  );
}
