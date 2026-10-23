"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { saveServices, type ServicesState } from "./actions";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { SecretKey, FeatureKey } from "@/lib/settings";

type Status = Record<SecretKey, { masked: string | null; source: "base" | "env" | null }>;

const SERVICES: Array<{ title: string; emoji: string; feature?: FeatureKey; featureLabel?: string; keys: Array<{ key: SecretKey; label: string; help: string }>; note?: string }> = [
  { title: "Claude (IA)", emoji: "🤖", feature: "feature_ai", featureLabel: "Rédiger les récaps mensuels et les réponses aux avis avec Claude",
    keys: [{ key: "anthropic_api_key", label: "Clé API Anthropic", help: "console.anthropic.com → API keys. Sans clé : gabarits en français." }] },
  { title: "Claude Code (modifications des sites)", emoji: "🛠️", feature: "feature_claude_code", featureLabel: "Bouton « Confier à Claude » sur les demandes de modification (worker lancé sur le Mac)",
    keys: [{ key: "claude_code_api_key", label: "Clé API Anthropic pour Claude Code", help: "console.anthropic.com → API keys. Peut être la même que celle du dessus ; une clé dédiée permet de suivre son coût à part." }] },
  { title: "Cloudflare Turnstile", emoji: "🛡️", feature: "feature_turnstile", featureLabel: "Vérifier le captcha sur les formulaires des sites clients",
    keys: [{ key: "turnstile_site_key", label: "Site key (publique)", help: "À coller aussi dans le snippet des sites." }, { key: "turnstile_secret_key", label: "Secret key", help: "dash.cloudflare.com → Turnstile." }] },
  { title: "Resend (emails)", emoji: "✉️", keys: [{ key: "resend_api_key", label: "Clé API Resend", help: "resend.com → API Keys. Domaine acco-lab.fr déjà vérifié." }] },
  { title: "Avis Google", emoji: "⭐", feature: "feature_business_api", featureLabel: "Lire et répondre aux vrais avis via l’API Business Profile", keys: [],
    note: "À cocher seulement une fois l’accès à l’API validé par Google et le compte Google connecté ci-dessus. Sinon les avis restent en mode démo." },
];

export function ServicesForm({ secrets, toggles, googleConnected }: { secrets: Status; toggles: Record<FeatureKey, boolean>; googleConnected: boolean }) {
  const [state, action] = useActionState<ServicesState, FormData>(saveServices, {});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const has = (k: SecretKey) => Boolean(secrets[k].masked) || Boolean(typed[k]?.trim());

  return (
    <form action={action} className="grid gap-3">
      {SERVICES.map((svc) => {
        const ready = svc.keys.every((k) => has(k.key)) && (svc.feature !== "feature_business_api" || googleConnected);
        return (
          <div key={svc.title} className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-title">{svc.emoji} {svc.title}</p>
              {svc.feature && (
                <label className={`flex items-center gap-2 text-sm ${ready ? "text-text-strong" : "text-muted"}`} title={ready ? "" : "Renseignez d’abord la clé"}>
                  <input type="checkbox" name={svc.feature} defaultChecked={toggles[svc.feature] && ready} disabled={!ready} className="size-4 accent-white disabled:opacity-40" />
                  Activer
                </label>
              )}
            </div>
            {svc.featureLabel && <p className="mt-1 text-xs text-text">{svc.featureLabel}</p>}
            {svc.feature && state.errors?.[svc.feature] && <p className="mt-1 text-xs text-pink">{state.errors[svc.feature]}</p>}
            {svc.feature && !state.errors?.[svc.feature] && toggles[svc.feature] && ready && <p className="mt-1 text-xs text-green">Activé.</p>}
            {svc.note && <p className="mt-2 text-xs text-muted">{svc.note}</p>}
            {svc.keys.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {svc.keys.map(({ key, label, help }) => {
                  const st = secrets[key];
                  return (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-medium text-text-strong">{label}</label>
                      <div className="flex items-center gap-2">
                        <Input
                          name={key}
                          type={show[key] ? "text" : "password"}
                          autoComplete="off"
                          placeholder={st.masked ? `${st.masked} (${st.source === "env" ? "depuis .env" : "enregistrée"})` : "Coller la clé"}
                          value={typed[key] ?? ""}
                          onChange={(e) => setTyped({ ...typed, [key]: e.target.value })}
                          className="py-2 text-sm"
                        />
                        <button type="button" onClick={() => setShow({ ...show, [key]: !show[key] })} aria-label="Afficher" className="flex size-10 shrink-0 items-center justify-center rounded-card border border-border text-text">{show[key] ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      </div>
                      {state.errors?.[key] ? <p className="mt-1 text-[11px] text-pink">{state.errors[key]}</p> : state.infos?.[key] ? <p className="mt-1 text-[11px] text-green">{state.infos[key]}</p> : <p className="mt-1 text-[11px] text-muted">{help}</p>}
                      {st.source === "base" && <label className="mt-1 flex items-center gap-1.5 text-[11px] text-muted"><input type="checkbox" name={`${key}__clear`} className="size-3 accent-white" /> Effacer la clé enregistrée</label>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-3"><SubmitButton size="sm" pendingLabel="Vérification des clés…">Enregistrer les clés et services</SubmitButton>{state.ok && <span className="text-sm text-green">Enregistré</span>}{state.ok === false && <span className="text-sm text-pink">Certaines clés n’ont pas été enregistrées.</span>}</div>
      <p className="text-xs text-muted">Chaque clé est testée auprès du service avant d’être enregistrée ; une fonction ne s’active que si ses clés sont valides. Les clés sont stockées dans la base (accès équipe uniquement) et affichées masquées. Une clé présente dans le fichier .env du serveur sert de repli.</p>
    </form>
  );
}
