"use client";

import { useState } from "react";
import { VideoIcon } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { LIEU_VISIO } from "@/lib/crm";

/**
 * Lieu d'un rendez-vous, partout dans l'app (Prospection, Suivi client, report d'un no show) :
 * - l'adresse de la fiche (prospect ou client) est préremplie, modifiable, vide si la fiche n'en a pas ;
 * - « Visio » cochée : le champ adresse disparaît et le lieu devient « Google Meet » (un lien Meet est créé dans Google Agenda) ;
 * - décochée : l'adresse réapparaît telle qu'elle était, elle n'est jamais perdue en changeant de mode.
 */
export function LieuVisio({ adresse, nameLieu = "lieu", nameMeet = "meet", defaultMeet = false, className }: { adresse: string | null; nameLieu?: string; nameMeet?: string; defaultMeet?: boolean; className?: string }) {
  const [meet, setMeet] = useState(defaultMeet);
  const [lieu, setLieu] = useState(adresse ?? "");
  return (
    <div className={className}>
      {meet ? (
        <Field label="Lieu">
          <div className="flex h-10 items-center gap-2 rounded-card border border-border bg-surface-2 px-3 text-sm text-title"><VideoIcon size={15} className="shrink-0 text-green" aria-hidden /> {LIEU_VISIO}</div>
          <input type="hidden" name={nameLieu} value={LIEU_VISIO} />
        </Field>
      ) : (
        <Field label="Lieu / adresse" hint={adresse ? "adresse de la fiche, modifiable" : "optionnel"}>
          <Input name={nameLieu} value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Adresse du rendez-vous" />
        </Field>
      )}
      <label className="mt-1.5 flex items-center gap-1.5 text-sm text-text-strong">
        <input type="checkbox" name={nameMeet} checked={meet} onChange={(e) => setMeet(e.target.checked)} className="size-4" /> Visio (Google Meet)
      </label>
    </div>
  );
}
