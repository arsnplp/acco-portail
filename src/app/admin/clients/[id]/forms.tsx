"use client";

import { useActionState, useState, useTransition } from "react";
import { ArchiveIcon, ArchiveRestoreIcon, CheckIcon, ImagePlusIcon, PencilIcon, SparklesIcon, XIcon } from "lucide-react";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LogoClient } from "@/components/ui/logo-client";
import { cn } from "@/lib/cn";
import {
  archiverClient, createSite, createSubscription, creerRdvClientAction, creerTacheClientAction, deleteClientContact, genererSyntheseClient, logClientEchange,
  reattribuerClient, removeLogo, saveClientContact, setRdvClientResultat, terminerTacheAction, updateClient, uploadLogo, rattacherEmailAction, rattacherAppelAction, synchroniserEmailsAction, type ActionState,
} from "../actions";
import { marquerImpaye, marquerPremierPaiement, proposerPourSite } from "@/app/admin/contrats/actions";

type Member = { id: string; name: string };
type SiteRef = { id: string; name: string };

/** Logo en en-tête (00.1) : clic pour déposer ou remplacer, initiales par défaut. */
export function LogoForm({ clientId, logo, name, externe }: { clientId: string; logo: string | null; name: string; externe: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadLogo.bind(null, clientId), {});
  const [, start] = useTransition();
  return (
    <div className="flex flex-col items-center gap-1">
      <form action={action} className="relative">
        <LogoClient id={clientId} name={name} logo={logo} size={72} />
        {!externe && (
          <label className={cn("absolute -right-1 -bottom-1 flex size-7 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-text hover:text-title", pending && "opacity-50")} title="Déposer un logo (PNG, JPG, SVG, WebP)">
            <ImagePlusIcon size={14} aria-hidden />
            <input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
          </label>
        )}
      </form>
      {logo && !externe && <button type="button" onClick={() => start(() => removeLogo(clientId))} className="text-[11px] text-text hover:text-pink">Retirer</button>}
      {state.error && <p className="max-w-40 text-center text-[11px] text-pink">{state.error}</p>}
    </div>
  );
}

export function ArchiverButton({ clientId, archive }: { clientId: string; archive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => confirm(archive ? "Restaurer ce client ?" : "Archiver ce client ? Rien n’est supprimé : contrats, sites et historique restent consultables.") && start(() => archiverClient(clientId, archive))} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-text hover:text-title disabled:opacity-50">
      {archive ? <ArchiveRestoreIcon size={14} /> : <ArchiveIcon size={14} />} {archive ? "Restaurer" : "Archiver"}
    </button>
  );
}

type ClientInfo = { id: string; name: string; address: string | null; phone: string | null; email: string | null; siren: string | null; secteur: string | null };
export function InfosForm({ client }: { client: ClientInfo }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await updateClient(client.id, prev, fd); if (!r.error) setOpen(false); return r; }, {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-sm text-text hover:text-title"><PencilIcon size={14} /> Modifier</button>;
  return (
    <form action={action} className="w-full space-y-3 rounded-card border border-border bg-surface p-4 text-left sm:w-[28rem]">
      <Field label="Nom"><Input name="name" defaultValue={client.name} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Activité / secteur"><Input name="secteur" defaultValue={client.secteur ?? ""} placeholder="Boulangerie, plombier…" /></Field>
        <Field label="SIREN"><Input name="siren" defaultValue={client.siren ?? ""} /></Field>
        <Field label="Téléphone"><Input name="phone" defaultValue={client.phone ?? ""} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={client.email ?? ""} /></Field>
      </div>
      <Field label="Adresse"><Input name="address" defaultValue={client.address ?? ""} /></Field>
      <FormError message={state.error} />
      <div className="flex gap-2"><SubmitButton size="sm">Enregistrer</SubmitButton><button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-text hover:text-title">Annuler</button></div>
    </form>
  );
}

export function NoteInterneForm({ clientId }: { clientId: string }) {
  const [key, setKey] = useState(0);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await logClientEchange(clientId, prev, fd); if (!r.error) setKey((k) => k + 1); return r; }, {});
  return (
    <form key={key} action={action} className="mt-3 space-y-2">
      <input type="hidden" name="type" value="NOTE" />
      <Textarea name="notes" required placeholder="Note interne (jamais visible du client)" className="min-h-16 text-sm" />
      <FormError message={state.error} />
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">Ajouter la note</SubmitButton>
    </form>
  );
}

export function SyntheseButton({ clientId, existe }: { clientId: string; existe: boolean }) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await genererSyntheseClient(clientId); setErreur(r.error ?? null); })} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text disabled:opacity-50">
        <SparklesIcon size={14} aria-hidden /> {pending ? "Rédaction…" : existe ? "Régénérer la synthèse IA" : "Générer une synthèse IA"}
      </button>
      {erreur && <p className="mt-1 text-xs text-pink">{erreur}</p>}
    </div>
  );
}

export function SiteCreateForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createSite.bind(null, clientId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
      <Field label="Nom du site"><Input name="name" placeholder="monsite.fr" required /></Field>
      <SubmitButton size="sm">Créer le site (en création)</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function ProposerButton({ clientId, siteId, offerId, label }: { clientId: string; siteId: string; offerId: string; label: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm(`Préparer un contrat brouillon : ${label} ?`) && start(() => proposerPourSite(clientId, siteId, offerId))} className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-text-strong hover:border-text disabled:opacity-50">{pending ? "…" : `+ ${label}`}</button>;
}

export function SubscriptionForm({ clientId, sites }: { clientId: string; sites: SiteRef[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createSubscription.bind(null, clientId), {});
  return (
    <details className="rounded-card border border-border bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-title">Ajouter un abonnement sur mesure (hors contrat)</summary>
      <form action={action} className="space-y-3 border-t border-border p-4">
        <Field label="Libellé"><Input name="label" placeholder="Site vitrine — abonnement" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix HT (€)"><Input name="price" inputMode="decimal" placeholder="49" required /></Field>
          <Field label="Facturation"><Select name="billing" defaultValue="MENSUEL"><option value="MENSUEL">Mensuel</option><option value="PONCTUEL">Ponctuel</option></Select></Field>
          <Field label="Site concerné"><Select name="siteId" defaultValue=""><option value="">Tous</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Quota modifs / mois" hint="(vide = illimité)"><Input name="monthlyQuota" inputMode="numeric" /></Field>
        </div>
        <Field label="Fin d’engagement"><Input name="commitmentEndsAt" type="date" /></Field>
        <FormError message={state.error} />
        <SubmitButton size="sm">Ajouter</SubmitButton>
      </form>
    </details>
  );
}

/** Finance V1 (00.10) : premier paiement et impayé saisis à la main, sans fournisseur. */
export function PaiementButtons({ contratId, premierPaiement, impaye }: { contratId: string; premierPaiement: boolean; impaye: boolean }) {
  const [pending, start] = useTransition();
  const cls = "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-2">
      {premierPaiement
        ? <button type="button" disabled={pending} onClick={() => confirm("Annuler la saisie « premier paiement reçu » ?") && start(() => marquerPremierPaiement(contratId, true))} className={cn(cls, "border-green/50 text-green")}><CheckIcon size={13} /> 1er paiement reçu · annuler</button>
        : <button type="button" disabled={pending} onClick={() => start(() => marquerPremierPaiement(contratId))} className={cn(cls, "border-border text-title hover:border-text")}>Premier paiement reçu</button>}
      {impaye
        ? <button type="button" disabled={pending} onClick={() => start(() => marquerImpaye(contratId, true))} className={cn(cls, "border-pink/50 text-pink")}>Impayé · régularisé</button>
        : <button type="button" disabled={pending} onClick={() => confirm("Signaler un impayé ? Alerte interne seulement, le client n’est pas prévenu.") && start(() => marquerImpaye(contratId))} className={cn(cls, "border-border text-text hover:text-pink")}>Signaler un impayé</button>}
    </div>
  );
}

type ContactInfo = { id: string; prenom: string | null; nom: string | null; fonction: string | null; email: string | null; telephone: string | null; principal: boolean; optOut: boolean };
export function ContactForm({ clientId, contact }: { clientId: string; contact: ContactInfo | null }) {
  const [key, setKey] = useState(0);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await saveClientContact(clientId, contact?.id ?? null, prev, fd); if (!r.error && !contact) setKey((k) => k + 1); return r; }, {});
  return (
    <form key={key} action={action} className={cn("space-y-2", !contact && "rounded-card border border-border bg-surface p-4")}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Prénom"><Input name="prenom" defaultValue={contact?.prenom ?? ""} /></Field>
        <Field label="Nom"><Input name="nom" defaultValue={contact?.nom ?? ""} /></Field>
        <Field label="Rôle"><Input name="fonction" defaultValue={contact?.fonction ?? ""} placeholder="Gérant, assistante…" /></Field>
        <Field label="Téléphone"><Input name="telephone" defaultValue={contact?.telephone ?? ""} /></Field>
      </div>
      <Field label="Email"><Input name="email" type="email" defaultValue={contact?.email ?? ""} /></Field>
      <label className="flex items-center gap-2 text-xs text-text-strong"><input type="checkbox" name="principal" defaultChecked={contact?.principal ?? false} className="size-4" /> Contact principal</label>
      <label className="flex items-center gap-2 text-xs text-text-strong"><input type="checkbox" name="optOut" defaultChecked={contact?.optOut ?? false} className="size-4" /> Ne plus recevoir de messages commerciaux (désinscription)</label>
      <FormError message={state.error} />
      <SubmitButton size="sm" variant={contact ? "secondary" : "primary"} pendingLabel="…">{contact ? "Enregistrer" : "Ajouter l’interlocuteur"}</SubmitButton>
    </form>
  );
}
export function ContactDeleteButton({ clientId, contactId, nom }: { clientId: string; contactId: string; nom: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => confirm(`Supprimer ${nom} des interlocuteurs ? Ses échanges restent dans l’historique.`) && start(() => deleteClientContact(clientId, contactId))} className="text-xs text-text hover:text-pink disabled:opacity-50">Supprimer ce contact</button>;
}

export function ReattribuerForm({ clientId, actuel, equipe, meId }: { clientId: string; actuel: string | null; equipe: Member[]; meId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(reattribuerClient.bind(null, clientId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
      <Field label="Nouveau référent"><Select name="commercialId" defaultValue={actuel ?? ""} required><option value="">Personne</option>{equipe.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === meId ? " (moi)" : ""}</option>)}</Select></Field>
      <Field label="Motif"><Input name="motif" placeholder="Départ, réorganisation…" /></Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">Réattribuer définitivement</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

const TYPES_TACHE: Array<[string, string]> = [["RELANCE", "Relance"], ["RDV_A_PLANIFIER", "RDV à planifier"], ["APPEL", "Appel"], ["EMAIL", "Email"], ["DOCUMENT", "Document à obtenir"], ["MAINTENANCE", "Maintenance"], ["AUTRE", "Autre"]];
export function TacheForm({ clientId, membres, sites, meId }: { clientId: string; membres: Member[]; sites: SiteRef[]; meId: string }) {
  const [key, setKey] = useState(0);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await creerTacheClientAction(clientId, prev, fd); if (!r.error) setKey((k) => k + 1); return r; }, {});
  return (
    <form key={key} action={action} className="space-y-2 rounded-card border border-border bg-surface p-4">
      <Field label="Tâche"><Input name="titre" required placeholder="Relancer pour les photos, appeler pour le renouvellement…" /></Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Type"><Select name="type" defaultValue="AUTRE">{TYPES_TACHE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Échéance"><Input name="echeance" type="date" /></Field>
        <Field label="Responsable"><Select name="responsableId" defaultValue={meId}>{membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Field label="Site"><Select name="siteId" defaultValue=""><option value="">—</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      </div>
      <Input name="description" placeholder="Détail (facultatif)" />
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="…">Ajouter la tâche</SubmitButton>
    </form>
  );
}
export function TacheButtons({ clientId, tacheId }: { clientId: string; tacheId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <button type="button" disabled={pending} onClick={() => start(() => terminerTacheAction(clientId, tacheId, "FAIT"))} aria-label="Fait" title="Fait" className="flex size-8 items-center justify-center rounded-full bg-green text-bg disabled:opacity-50"><CheckIcon size={14} /></button>
      <button type="button" disabled={pending} onClick={() => confirm("Annuler cette tâche ?") && start(() => terminerTacheAction(clientId, tacheId, "ANNULEE"))} aria-label="Annuler" title="Annuler" className="flex size-8 items-center justify-center rounded-full border border-border text-text hover:text-pink disabled:opacity-50"><XIcon size={14} /></button>
    </div>
  );
}

export function RdvForm({ clientId, membres, sites, meId, contacts = [] }: { clientId: string; membres: Member[]; sites: SiteRef[]; meId: string; contacts?: { email: string; nom: string }[] }) {
  const [key, setKey] = useState(0);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await creerRdvClientAction(clientId, prev, fd); if (!r.error) setKey((k) => k + 1); return r; }, {});
  return (
    <form key={key} action={action} className="space-y-2 rounded-card border border-border bg-surface p-4">
      <Field label="Objet"><Input name="titre" placeholder="Présentation de la maquette, point de suivi, livraison…" /></Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Date"><Input name="date" type="date" required /></Field>
        <Field label="Heure"><Input name="heure" type="time" required defaultValue="10:00" /></Field>
        <Field label="Durée (min)"><Input name="duree" inputMode="numeric" defaultValue="60" /></Field>
        <Field label="Avec"><Select name="commercialId" defaultValue={meId}>{membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Field label="Lieu / visio"><Input name="lieu" placeholder="Sur place, Google Meet…" /></Field>
        <Field label="Site"><Select name="siteId" defaultValue=""><option value="">—</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-text-strong">
        <label className="flex items-center gap-1.5"><input type="checkbox" name="meet" className="size-4" /> Créer un lien Google Meet</label>
        {contacts.map((c) => <label key={c.email} className="flex items-center gap-1.5"><input type="checkbox" name="invites" value={c.email} className="size-4" /> Inviter {c.nom}</label>)}
      </div>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="…">Fixer le rendez-vous</SubmitButton>
      <p className="text-[11px] text-muted">Ajouté dans l’agenda Google du membre si son compte est connecté (invitations envoyées aux contacts cochés). Un RDV déplacé ou annulé dans Google est répercuté ici.</p>
    </form>
  );
}
export function RdvButtons({ clientId, rdvId }: { clientId: string; rdvId: string }) {
  const [pending, start] = useTransition();
  const b = "h-8 rounded-full border border-border px-2.5 text-xs text-text hover:text-title disabled:opacity-50";
  return (
    <div className="flex gap-1">
      <button type="button" disabled={pending} onClick={() => start(() => setRdvClientResultat(clientId, rdvId, "FAIT"))} className={b}>Tenu</button>
      <button type="button" disabled={pending} onClick={() => start(() => setRdvClientResultat(clientId, rdvId, "NO_SHOW"))} className={b}>Absent</button>
      <button type="button" disabled={pending} onClick={() => confirm("Annuler ce rendez-vous ?") && start(() => setRdvClientResultat(clientId, rdvId, "ANNULE"))} className={b}>Annuler</button>
    </div>
  );
}

export function RattacherEmailForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(rattacherEmailAction.bind(null, clientId), {});
  return <form action={action} className="flex flex-wrap items-end gap-2"><Field label="Rattacher un email non reconnu" hint="identifiant du message ou lien Gmail"><Input name="ref" required placeholder="18f3a2…" /></Field><SubmitButton size="sm" variant="secondary" pendingLabel="…">Rattacher</SubmitButton><FormError message={state.error} /></form>;
}
export function SyncEmailsButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return <div><button type="button" disabled={pending} onClick={() => start(async () => { const r = await synchroniserEmailsAction(clientId); setMsg(r.error ?? `${r.added ?? 0} nouveau${(r.added ?? 0) > 1 ? "x" : ""} message${(r.added ?? 0) > 1 ? "s" : ""}.`); })} className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs text-title hover:border-text disabled:opacity-50">{pending ? "Synchronisation…" : "Actualiser depuis Gmail"}</button>{msg && <p className="mt-1 text-xs text-text">{msg}</p>}</div>;
}
export function RattacherAppelButton({ clientId, echangeId }: { clientId: string; echangeId: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => rattacherAppelAction(clientId, echangeId))} className="h-7 rounded-full border border-border px-2.5 text-xs text-title hover:border-text disabled:opacity-50">{pending ? "…" : "Rattacher à ce client"}</button>;
}
