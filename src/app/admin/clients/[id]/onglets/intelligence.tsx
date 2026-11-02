import { BotIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/ui/card";
import { enBref } from "@/lib/en-bref";
import { fmtDayTime } from "@/lib/crm";
import { SyntheseButton } from "../forms";
import type { Ctx } from "./ctx";

/** Onglet Intelligence client (4.3, 00.6) : affiché seulement quand l'IA est activée ; faits calculés, synthèse sur clic. */
export async function IntelligenceOnglet({ clientId }: Ctx) {
  const [bref, synthese] = await Promise.all([enBref(clientId), prisma.setting.findUnique({ where: { key: `synthese_client:${clientId}` } })]);
  const synth = synthese ? (JSON.parse(synthese.value) as { texte: string; at: string; par: string }) : null;
  return (
    <div className="space-y-5">
      <SectionTitle icon={BotIcon}>Faits (calculés, sans IA)</SectionTitle>
      <ul className="space-y-1 rounded-card border border-border bg-surface p-4 text-sm text-text-strong">{bref.faits.map((f, i) => <li key={i}>{f}</li>)}{bref.dernieres.map((f, i) => <li key={`d${i}`} className="text-text">{f}</li>)}</ul>
      {(bref.alertes.length > 0 || bref.opportunites.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-surface p-4 text-sm"><p className="text-xs font-semibold tracking-wide text-pink uppercase">Signaux de risque</p><ul className="mt-1 space-y-1 text-text-strong">{bref.alertes.length === 0 ? <li className="text-text">Aucun.</li> : bref.alertes.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
          <div className="rounded-card border border-border bg-surface p-4 text-sm"><p className="text-xs font-semibold tracking-wide text-green uppercase">Opportunités</p><ul className="mt-1 space-y-1 text-text-strong">{bref.opportunites.length === 0 ? <li className="text-text">Aucune détectée.</li> : bref.opportunites.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
        </div>
      )}
      <SectionTitle>Synthèse IA (sur clic)</SectionTitle>
      <div className="rounded-card border border-border bg-surface p-4 text-sm">
        {synth ? <><p className="whitespace-pre-line text-text-strong">{synth.texte}</p><p className="mt-2 text-[11px] text-muted">Générée le {fmtDayTime(synth.at)} par {synth.par}. Les hypothèses sont à vérifier avant d’agir.</p></> : <p className="text-text">Aucune synthèse générée. Chaque génération consomme des crédits et s’inscrit dans le plafond mensuel.</p>}
        <div className="mt-3"><SyntheseButton clientId={clientId} existe={!!synth} /></div>
      </div>
    </div>
  );
}
