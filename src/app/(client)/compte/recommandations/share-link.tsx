"use client";

import { useState } from "react";
import { Copy, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareLink({ url, firstName }: { url: string; firstName: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Bonjour ! Je vous recommande Acco, l’agence qui a fait mon site internet. Voici mon lien : ${url}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }
  return (
    <div className="space-y-3">
      <div className="truncate rounded-card border border-border bg-bg px-3 py-2 text-xs text-text-strong">{url}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={copy}>{copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier</>}</Button>
        {canShare ? (
          <Button onClick={() => navigator.share({ title: `${firstName} vous recommande Acco`, text, url }).catch(() => {})}><Share2 size={16} /> Partager</Button>
        ) : (
          <Button href={`mailto:?subject=${encodeURIComponent("Je vous recommande Acco")}&body=${encodeURIComponent(text)}`}><Share2 size={16} /> Envoyer</Button>
        )}
      </div>
    </div>
  );
}
