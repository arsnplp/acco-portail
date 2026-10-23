"use client";

import type { NotificationPreference } from "@prisma/client";
import { EnablePush } from "@/components/push/enable-push";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toggle } from "@/components/ui/toggle";
import { saveAdminNotifPrefs } from "./actions";

const EVENTS: Array<[keyof NotificationPreference, string]> = [
  ["changes", "Nouvelle demande de modification (ou rouverte)"],
  ["messages", "Message d’un client"],
  ["referrals", "Nouvelle recommandation"],
  ["documents", "Document ou fichier envoyé par un client"],
];

export function AdminNotifForm({ prefs }: { prefs: NotificationPreference | null }) {
  const get = (k: keyof NotificationPreference) => (prefs ? Boolean(prefs[k]) : true);
  return (
    <div className="grid gap-3">
      <div className="rounded-card border border-border bg-surface p-4">
        <EnablePush />
        <p className="mt-2 text-xs text-muted">À activer sur chaque appareil (ordinateur, téléphone). Sur iPhone : ajoutez d’abord l’app à l’écran d’accueil.</p>
      </div>
      <form action={saveAdminNotifPrefs} className="rounded-card border border-border bg-surface">
        <div className="border-b border-border"><Toggle name="pushEnabled" label="Recevoir les notifications push" defaultChecked={get("pushEnabled")} /></div>
        <div className="divide-y divide-border">
          {EVENTS.map(([k, label]) => <Toggle key={k} name={k} label={label} defaultChecked={get(k)} />)}
        </div>
        <div className="p-4"><SubmitButton size="sm" variant="secondary">Enregistrer</SubmitButton></div>
      </form>
    </div>
  );
}
