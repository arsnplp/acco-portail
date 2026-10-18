"use client";

import { useActionState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { sendMagicLink, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.ok) {
    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-green shrink-0 mt-0.5" size={22} strokeWidth={1.75} />
          <div>
            <p className="text-title font-semibold">Regardez vos emails</p>
            <p className="text-text text-sm mt-1">
              Si <span className="text-text-strong">{state.email}</span> est bien un compte Acco, un lien de connexion vient
              d’être envoyé. Il est valable 1 heure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm text-text-strong">Votre email</span>
        <div className="mt-2 flex items-center gap-3 rounded-card border border-border bg-surface px-4 focus-within:border-blue transition-colors">
          <Mail size={18} strokeWidth={1.75} className="text-text" />
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="vous@entreprise.fr"
            className="w-full bg-transparent py-4 text-base text-title placeholder:text-muted outline-none"
          />
        </div>
      </label>
      {state.error && <p className="text-sm text-pink">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir mon lien"}
      </Button>
    </form>
  );
}
