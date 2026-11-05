import { Toggle } from "@/components/ui/toggle";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FONCTION_LABEL, plafondCents, usageDuMois, type FonctionIA } from "@/lib/ia";
import { etatConnecteurs } from "@/lib/connecteurs";
import { featureToggles } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { fmtDayTime } from "@/lib/crm";
import { saveIaIntegrations } from "./actions";

const euros = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Administration > IA et intégrations (00.6, 00.7) : tout ce qui consomme des crédits est désactivé par défaut et se
 * déclenche sur clic ; plafond mensuel ; compteur ; chaque connecteur avec son état (OK / En erreur quand la dernière synchro a échoué), sa dernière synchro ; le détail de l'erreur seulement pour le gestionnaire.
 */
export async function IaIntegrationsForm({ gestionnaire = false }: { gestionnaire?: boolean }) {
  const [toggles, plafond, usage, connecteurs, flags] = await Promise.all([featureToggles(), plafondCents(), usageDuMois(), etatConnecteurs(), prisma.setting.findMany({ where: { key: { startsWith: "ia_" } } })]);
  const on = (f: FonctionIA) => flags.find((x) => x.key === `ia_${f}`)?.value === "true";
  const fonctions = Object.keys(FONCTION_LABEL) as FonctionIA[];
  const atteint = plafond > 0 && usage.total >= plafond;
  return (
    <form action={saveIaIntegrations} className="grid gap-3">
      <div className="rounded-card border border-border bg-surface">
        <div className="border-b border-border"><Toggle name="feature_ai" label="Activer l’IA (Claude) — désactivée par défaut, uniquement sur clic" defaultChecked={toggles.feature_ai} /></div>
        <div className="divide-y divide-border">
          {fonctions.map((f) => <Toggle key={f} name={`ia_${f}`} label={FONCTION_LABEL[f]} defaultChecked={on(f)} />)}
        </div>
        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
          {gestionnaire ? <Field label="Plafond mensuel de dépense (€)" hint="0 = sans plafond, réglé par Arsène"><Input name="plafond_euros" inputMode="decimal" defaultValue={(plafond / 100).toString()} /></Field> : <div className="rounded-card border border-border bg-surface-2 p-3 text-sm text-text">Plafond mensuel : <span className="font-semibold text-title">{plafond ? euros(plafond) : "sans plafond"}</span> (réglé par Arsène)</div>}
          <div className="rounded-card border border-border bg-surface-2 p-3 text-sm">
            <p className="font-semibold text-title">Ce mois-ci : {euros(usage.total)} · {usage.appels} appel{usage.appels > 1 ? "s" : ""}</p>
            {atteint && <p className="mt-1 text-xs text-pink">Plafond atteint : l’IA est coupée jusqu’au mois prochain, le reste de l’application fonctionne normalement.</p>}
            <ul className="mt-2 space-y-0.5 text-xs text-text">
              {usage.parFonction.length === 0 ? <li>Aucun appel ce mois-ci.</li> : usage.parFonction.map((u) => <li key={u.fonction}>{FONCTION_LABEL[u.fonction] ?? u.fonction} : {u.appels} appel{u.appels > 1 ? "s" : ""} · {euros(u.coutCents)}</li>)}
            </ul>
          </div>
        </div>
        <p className="px-4 pb-4 text-xs text-muted">Aucun appel IA au chargement d’une page ni en tâche de fond : chaque fonction se lance sur clic, son résultat est mis en cache, et les coûts sont estimés d’après les jetons consommés.</p>
      </div>

      <div className="rounded-card border border-border bg-surface">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold text-title">Connecteurs externes</p>
        <div className="divide-y divide-border">
          {connecteurs.map((c) => (
            <div key={c.connecteur}>
              {c.connecteur === "financier"
                ? <div className="flex items-center justify-between gap-3 px-4 py-3 opacity-60"><span className="text-sm text-text-strong">{c.label}</span><span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">Bientôt disponible</span></div>
                : <Toggle name={`feature_${c.connecteur === "business_profile" ? "business_api" : c.connecteur}`} label={c.label} defaultChecked={c.actif} />}
              {c.connecteur !== "financier" && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-xs text-text">
                  {c.bloque
                    ? <span className="rounded-full border border-pink/50 bg-pink/10 px-2 py-0.5 font-semibold text-pink">En erreur</span>
                    : c.actif ? <span className="rounded-full border border-green/40 bg-green/10 px-2 py-0.5 font-semibold text-green">OK</span> : null}
                  <span>{c.derniereSync ? `Dernière synchronisation : ${fmtDayTime(c.derniereSync)}` : "Jamais synchronisé"}</span>
                  {/* Le détail de l'erreur n'est montré qu'au gestionnaire : les autres voient seulement l'état. */}
                  {c.bloque && gestionnaire && <span className="basis-full text-pink">{fmtDayTime(c.bloque.createdAt)} · {c.bloque.message}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="px-4 pb-4 text-xs text-muted">Un connecteur coupé ou en panne ne bloque rien : la saisie manuelle reste possible partout.</p>
      </div>
      <div><SubmitButton size="sm">Enregistrer</SubmitButton></div>
    </form>
  );
}
