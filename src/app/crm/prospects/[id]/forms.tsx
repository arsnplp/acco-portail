"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { EchangeType, ProspectSource, ProspectStatut, RdvResultat } from "@prisma/client";
import { UserXIcon, CalendarClockIcon, CheckIcon, HistoryIcon, MessageSquarePlusIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon, UserRoundIcon, BuildingIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ECHANGE, ECHANGE_SAISIE, NOTE_OBLIGATOIRE, MOTIFS_PERTE, PIPELINE, REGLES, SOURCE, STATUT, fmtDayTime, statutApres } from "@/lib/crm";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionTitle } from "@/components/ui/card";
import { assignProspect, deleteContact, deleteEchange, deleteProspect, logEchange, saveContact, setRdvResultat, updateProspect, type CrmState } from "../../actions";

const box = "rounded-card border border-border bg-surface p-4";
const plusDays = (today: string, n: number) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ─── Noter un échange ────────────────────────────────────────
export function EchangeForm({ prospectId, statut, session, today }: { prospectId: string; statut: ProspectStatut; session: boolean; today: string }) {
  const [type, setType] = useState<EchangeType | null>(null);
  const [relance, setRelance] = useState("");
  const [next, setNext] = useState<ProspectStatut>(statut);
  const [key, setKey] = useState(0);
  const [report, setReport] = useState(false);
  const [state, action] = useActionState<CrmState, FormData>(async (prev, fd) => {
    const r = await logEchange(prospectId, prev, fd);
    if (r.ok) { setType(null); setRelance(""); setReport(false); setKey((k) => k + 1); }
    return r;
  }, {});

  function pick(t: EchangeType) {
    setType(t);
    setReport(false);
    const r = REGLES[t];
    setNext(statutApres(t, statut));
    setRelance(r.relanceJours !== null ? plusDays(today, r.relanceJours) : "");
  }
  const shortcuts: [string, number][] = [["Demain", 1], ["2 jours", 2], ["1 semaine", 7], ["1 mois", 30]];

  return (
    <section>
      <SectionTitle icon={MessageSquarePlusIcon}>Noter un échange</SectionTitle>
      <form key={key} action={action} className={cn(box, "space-y-4")}>
        <input type="hidden" name="session" value={session ? "1" : "0"} />
        <input type="hidden" name="type" value={type ?? ""} />
        <input type="hidden" name="report" value={report ? "1" : "0"} />
        <div className="grid grid-cols-3 gap-2">
          {ECHANGE_SAISIE.map((t) => {
            const on = type === t || (t === "RDV" && type === "NO_SHOW");
            return (
              <button key={t} type="button" onClick={() => pick(t)} className={cn("h-11 rounded-card border text-sm font-semibold transition-colors", on ? "border-title bg-title text-bg" : "border-border text-text-strong hover:border-text")}>
                {ECHANGE[t].short}
              </button>
            );
          })}
        </div>
        {(type === "RDV" || type === "NO_SHOW") && (
          <div>
            <p className="mb-2 text-sm font-medium text-text-strong">Le prospect est-il venu ?</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => pick("RDV")} className={cn("flex h-11 items-center justify-center gap-2 rounded-card border text-sm font-semibold", type === "RDV" ? "border-green bg-green/15 text-green" : "border-border text-text-strong hover:border-text")}><CheckIcon size={16} aria-hidden /> Oui, RDV honoré</button>
              <button type="button" onClick={() => pick("NO_SHOW")} className={cn("flex h-11 items-center justify-center gap-2 rounded-card border text-sm font-semibold", type === "NO_SHOW" ? "border-pink bg-pink/15 text-pink" : "border-border text-text-strong hover:border-text")}><UserXIcon size={16} aria-hidden /> No show</button>
            </div>
            {type === "NO_SHOW" && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-text">Le RDV passe en « no show » : il ne compte pas dans les RDV pris des stats.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setReport(false); setNext("POSER_RDV"); setRelance(plusDays(today, 1)); }} className={cn("h-10 rounded-card border text-sm", !report ? "border-title bg-title font-semibold text-bg" : "border-border text-text-strong hover:border-text")}>À recaler plus tard</button>
                  <button type="button" onClick={() => { setReport(true); setNext("RDV_POSE"); }} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-card border text-sm", report ? "border-title bg-title font-semibold text-bg" : "border-border text-text-strong hover:border-text")}><CalendarClockIcon size={15} aria-hidden /> Reporter le RDV</button>
                </div>
                {report && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_1fr]">
                      <Field label="Nouvelle date"><Input type="date" name="reportDay" required min={today} /></Field>
                      <Field label="Heure"><Input type="time" name="reportTime" defaultValue="10:00" step={900} /></Field>
                      <div className="col-span-2 sm:col-span-1"><Field label="Lieu" hint="optionnel"><Input name="reportLieu" placeholder="Sur place, visio…" /></Field></div>
                    </div>
                    <p className="text-xs text-text">Le report est rattaché au RDV manqué : il ne compte pas comme un nouveau RDV pris.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {type && (
          <>
            {NOTE_OBLIGATOIRE.includes(type) ? (
              <Field label="Note" hint="obligatoire"><Textarea name="notes" required placeholder="Ce qui s’est dit, ce qu’il faut retenir" className="min-h-20" autoFocus /></Field>
            ) : (
              <Textarea name="notes" placeholder={type === "NRP" ? "Note (optionnelle) : messagerie, barrage…" : type === "NO_SHOW" ? "Note (optionnelle) : prévenu ou pas…" : "Note (optionnelle)"} className="min-h-20" />
            )}
            {type === "PRISE_RDV" && (
              <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <Field label="Date du RDV"><Input type="date" name="rdvDay" required min={today} /></Field>
                <Field label="Heure"><Input type="time" name="rdvTime" defaultValue="10:00" step={900} /></Field>
                <div className="col-span-2 sm:col-span-1"><Field label="Lieu" hint="optionnel"><Input name="rdvLieu" placeholder="Sur place, visio…" /></Field></div>
              </div>
            )}
            {type !== "PRISE_RDV" && !report && (
              <div>
                <p className="mb-2 text-sm font-medium text-text-strong">Prochaine relance</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {shortcuts.map(([label, n]) => {
                    const v = plusDays(today, n);
                    return <button key={label} type="button" onClick={() => setRelance(v)} className={cn("rounded-full border px-3 py-1.5 text-xs", relance === v ? "border-title bg-title font-semibold text-bg" : "border-border text-text hover:text-title")}>{label}</button>;
                  })}
                  <Input type="date" name="relance" value={relance} onChange={(e) => setRelance(e.target.value)} className="h-9 w-auto px-3 py-1 text-sm" />
                </div>
              </div>
            )}
            <Field label="Statut après l’échange">
              <Select name="statut" value={next} onChange={(e) => setNext(e.target.value as ProspectStatut)}>
                {[...PIPELINE, "GAGNE" as const, "PERDU" as const].map((s) => <option key={s} value={s}>{STATUT[s].label}</option>)}
              </Select>
            </Field>
            <FormError message={state.error} />
            <SubmitButton className="w-full" pendingLabel="Enregistrement…">{session ? "Enregistrer et passer au suivant" : "Enregistrer"}</SubmitButton>
          </>
        )}
      </form>
    </section>
  );
}

// ─── Historique ──────────────────────────────────────────────
type Item = { id: string; type: EchangeType; notes: string | null; date: string; auteur: string | null; client: boolean };
export function Historique({ items }: { items: Item[] }) {
  const [, start] = useTransition();
  return (
    <section>
      <SectionTitle icon={HistoryIcon}>Historique <span className="text-sm font-normal text-text">{items.length}</span></SectionTitle>
      {items.length === 0 ? <p className="text-sm text-text">Aucun échange pour l’instant.</p> : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {items.map((e) => (
            <li key={e.id} className="group relative">
              <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-bg", e.type === "NRP" ? "bg-muted" : e.type === "NO_SHOW" ? "bg-pink" : e.type === "PRISE_RDV" || e.type === "RDV" ? "bg-claude" : "bg-blue")} />
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-text">
                <span className={cn("font-semibold", e.type === "NO_SHOW" ? "text-pink" : "text-text-strong")}>{ECHANGE[e.type].short}</span>
                <span>{fmtDayTime(e.date)}</span>
                {e.auteur && <span>· {e.auteur}</span>}
                {e.client && <span className="text-green">· client</span>}
                {!e.client && <button type="button" onClick={() => confirm("Supprimer cet échange ?") && start(() => deleteEchange(e.id))} className="ml-auto hidden text-muted hover:text-pink group-hover:inline" aria-label="Supprimer"><Trash2Icon size={13} /></button>}
              </div>
              {e.notes && <p className="mt-1 text-sm whitespace-pre-line text-text-strong">{e.notes.length > 600 ? e.notes.slice(0, 600) + "…" : e.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ─── Rendez-vous ─────────────────────────────────────────────
export function RdvList({ items }: { items: { id: string; debut: string; lieu: string | null; resultat: RdvResultat; report: boolean }[] }) {
  const [, start] = useTransition();
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle icon={CalendarClockIcon}>Rendez-vous</SectionTitle>
      <ul className={cn(box, "divide-y divide-border p-0")}>
        {items.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className={cn("font-semibold", r.resultat === "ANNULE" ? "text-muted line-through" : r.resultat === "NO_SHOW" ? "text-pink" : "text-title")}>{fmtDayTime(r.debut)}</p>
              {(r.lieu || r.report) && <p className="truncate text-xs text-text">{[r.report ? "Report d’un no show" : null, r.lieu].filter(Boolean).join(" · ")}</p>}
            </div>
            <select value={r.resultat} onChange={(e) => start(() => setRdvResultat(r.id, e.target.value as "FAIT" | "ANNULE" | "PREVU" | "NO_SHOW"))} className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-strong" aria-label="Résultat du RDV">
              <option value="PREVU">Prévu</option><option value="FAIT">Honoré</option><option value="NO_SHOW">No show</option><option value="ANNULE">Annulé</option>
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Contacts ────────────────────────────────────────────────
type C = { id: string; prenom: string | null; nom: string | null; fonction: string | null; email: string | null; telephone: string | null; principal: boolean };
export function Contacts({ prospectId, contacts }: { prospectId: string; contacts: C[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, start] = useTransition();
  return (
    <section>
      <SectionTitle icon={UserRoundIcon} action={<button type="button" onClick={() => setEditing("new")} className="flex items-center gap-1 text-sm text-text hover:text-title"><PlusIcon size={15} /> Ajouter</button>}>Contacts</SectionTitle>
      <div className={cn(box, "divide-y divide-border p-0")}>
        {contacts.length === 0 && editing !== "new" && <p className="px-4 py-3 text-sm text-text">Aucun contact.</p>}
        {contacts.map((c) => editing === c.id ? <ContactForm key={c.id} prospectId={prospectId} c={c} onDone={() => setEditing(null)} /> : (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-title">{[c.prenom, c.nom].filter(Boolean).join(" ")}{c.principal && <StarIcon size={12} className="shrink-0 fill-yellow text-yellow" aria-label="Contact principal" />}</p>
              <p className="truncate text-xs text-text">{[c.fonction, c.telephone, c.email].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            {c.telephone && <a href={`tel:${c.telephone.replace(/\s/g, "")}`} className="text-xs text-text hover:text-title">Appeler</a>}
            <button type="button" onClick={() => setEditing(c.id)} aria-label="Modifier" className="text-text hover:text-title"><PencilIcon size={14} /></button>
            <button type="button" onClick={() => confirm("Supprimer ce contact ?") && start(() => deleteContact(c.id))} aria-label="Supprimer" className="text-text hover:text-pink"><Trash2Icon size={14} /></button>
          </div>
        ))}
        {editing === "new" && <ContactForm prospectId={prospectId} onDone={() => setEditing(null)} />}
      </div>
    </section>
  );
}

function ContactForm({ prospectId, c, onDone }: { prospectId: string; c?: C; onDone: () => void }) {
  const [state, action] = useActionState<CrmState, FormData>(saveContact.bind(null, prospectId, c?.id ?? null), {});
  useEffect(() => { if (state.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="space-y-2 px-4 py-3">
      <div className="grid grid-cols-2 gap-2">
        <Input name="prenom" placeholder="Prénom" defaultValue={c?.prenom ?? ""} autoFocus />
        <Input name="nom" placeholder="Nom" defaultValue={c?.nom ?? ""} />
        <Input name="telephone" placeholder="Téléphone" defaultValue={c?.telephone ?? ""} inputMode="tel" />
        <Input name="email" type="email" placeholder="Email" defaultValue={c?.email ?? ""} />
        <Input name="fonction" placeholder="Fonction (gérant…)" defaultValue={c?.fonction ?? ""} className="col-span-2" />
      </div>
      <label className="flex items-center gap-2 text-sm text-text-strong"><input type="checkbox" name="principal" defaultChecked={c?.principal} className="accent-white" /> Contact principal</label>
      <FormError message={state.error} />
      <div className="flex gap-2"><SubmitButton size="sm">Enregistrer</SubmitButton><button type="button" onClick={onDone} className="px-3 text-sm text-text hover:text-title">Annuler</button></div>
    </form>
  );
}

// ─── Fiche société ───────────────────────────────────────────
type P = {
  id: string; societe: string; siren: string | null; siret: string | null; dirigeant: string | null; adresse: string | null; siteWeb: string | null; telephone: string | null;
  cible: string | null; source: ProspectSource | null; statut: ProspectStatut; motifPerte: string | null; potentielEuros: number | null; fraisCreationEuros: number | null;
  mensuelEuros: number | null; commercialId: string | null; relance: string; isClient: boolean;
};
export function ProspectForm({ p, team, cibles, canDelete }: { p: P; team: { id: string; name: string }[]; cibles: string[]; canDelete: boolean }) {
  const [state, action] = useActionState<CrmState, FormData>(updateProspect.bind(null, p.id), {});
  const [statut, setStatut] = useState(p.statut);
  const [, start] = useTransition();
  const saved = !!state.ok;
  return (
    <section>
      <SectionTitle icon={BuildingIcon}>Société</SectionTitle>
      <form action={action} className={cn(box, "space-y-3")}>
        <Field label="Société"><Input name="societe" defaultValue={p.societe} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Statut">
            <Select name="statut" value={statut} onChange={(e) => setStatut(e.target.value as ProspectStatut)}>
              {[...PIPELINE, "GAGNE" as const, "PERDU" as const].map((s) => <option key={s} value={s}>{STATUT[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Prochaine relance"><Input type="date" name="relance" defaultValue={p.relance} /></Field>
        </div>
        {statut === "PERDU" && (
          <Field label="Motif de perte">
            <Select name="motifPerte" defaultValue={p.motifPerte ?? ""}><option value="">—</option>{MOTIFS_PERTE.map((m) => <option key={m}>{m}</option>)}</Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Commercial">
            <Select name="commercialId" defaultValue={p.commercialId ?? ""}><option value="">Personne</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
          </Field>
          <Field label="Cible">
            <Input name="cible" list="cibles" defaultValue={p.cible ?? ""} placeholder="Esthéticienne…" />
            <datalist id="cibles">{cibles.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Source">
            <Select name="source" defaultValue={p.source ?? ""}><option value="">—</option>{(Object.keys(SOURCE) as ProspectSource[]).map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}</Select>
          </Field>
          <Field label="Téléphone"><Input name="telephone" defaultValue={p.telephone ?? ""} inputMode="tel" /></Field>
        </div>
        <Field label="Site web"><Input name="siteWeb" defaultValue={p.siteWeb ?? ""} placeholder="exemple.fr" /></Field>
        <Field label="Adresse"><Input name="adresse" defaultValue={p.adresse ?? ""} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dirigeant"><Input name="dirigeant" defaultValue={p.dirigeant ?? ""} /></Field>
          <Field label="SIREN"><Input name="siren" defaultValue={p.siren ?? ""} inputMode="numeric" /></Field>
        </div>
        <Field label="SIRET"><Input name="siret" defaultValue={p.siret ?? ""} inputMode="numeric" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Potentiel" hint="€/mois"><Input name="potentielEuros" defaultValue={p.potentielEuros ?? ""} inputMode="numeric" /></Field>
          <Field label="Création" hint="€ signés"><Input name="fraisCreationEuros" defaultValue={p.fraisCreationEuros ?? ""} inputMode="numeric" /></Field>
          <Field label="Abonnement" hint="€/mois signés"><Input name="mensuelEuros" defaultValue={p.mensuelEuros ?? ""} inputMode="numeric" /></Field>
        </div>
        <FormError message={state.error} />
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
          {saved && <span className="flex items-center gap-1 text-sm text-green"><CheckIcon size={15} /> Enregistré</span>}
          {canDelete && <button type="button" onClick={() => confirm("Supprimer définitivement cette fiche et son historique ?") && start(() => deleteProspect(p.id))} className="ml-auto text-sm text-text hover:text-pink">Supprimer la fiche</button>}
        </div>
      </form>
    </section>
  );
}

export function AssignButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => assignProspect(id, "me"))} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-title hover:border-text disabled:opacity-50">
      {pending ? "…" : "Je reprends"}
    </button>
  );
}
