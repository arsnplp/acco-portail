"use client";

import { useActionState } from "react";
import { Send, RefreshCw } from "lucide-react";
import { publishReviewReply, regenerateSuggestion, type ReplyState } from "./actions";
import { Textarea, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ReplyForm({ siteId, reviewId, suggestion }: { siteId: string; reviewId: string; suggestion: string | null }) {
  const [state, action] = useActionState<ReplyState, FormData>(publishReviewReply.bind(null, siteId, reviewId), {});
  return (
    <form action={action} className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-blue">Réponse proposée, modifiez-la si besoin</p>
      <Textarea name="reply" defaultValue={suggestion ?? ""} className="min-h-24 text-sm" key={suggestion ?? "vide"} />
      <FormError message={state.error} />
      <div className="flex items-center gap-2">
        <SubmitButton size="sm" pendingLabel="Publication…"><Send size={14} /> Publier</SubmitButton>
        <button type="submit" formAction={regenerateSuggestion.bind(null, siteId, reviewId)} formNoValidate className="inline-flex h-9 items-center gap-1 px-2 text-xs text-text hover:text-title">
          <RefreshCw size={12} /> Autre proposition
        </button>
      </div>
    </form>
  );
}
