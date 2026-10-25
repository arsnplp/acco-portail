"use client";

import { useActionState, useState } from "react";
import { CheckIcon, PackageIcon, PlusIcon, ShoppingBagIcon, XIcon } from "lucide-react";
import { activateOffer, cancelSubscription, type ActionState } from "../actions";
import { FormError, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";

export type ActiveSub = { id: string; label: string; price: string; since: string; site: string | null; endsAt: string | null; quota: number | null };
export type OfferRow = { id: string; name: string; benefit: string; price: string; module: string | null; mensuel: boolean; actives: ActiveSub[]; commandee: boolean };

/** Les offres du client, claires : ce qu'il a (vert), ce qu'il a commandé (à traiter), ce qu'on peut lui activer. */
export function OffresClient({ clientId, totaux, base, offres, resiliees, sites }: {
  clientId: string;
  totaux: { actives: number; mensuel: string; ponctuel: string };
  base: ActiveSub[];
  offres: OfferRow[];
  resiliees: { id: string; label: string; quand: string }[];
  sites: { id: string; name: string }[];
}) {
  const actives = offres.filter((o) => o.actives.length);
  const autres = offres.filter((o) => !o.actives.length);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Offres actives" value={String(totaux.actives)} />
        <Tile label="Par mois" value={totaux.mensuel} accent />
        <Tile label="Ponctuel" value={totaux.ponctuel} />
      </div>

      {base.length > 0 && (
        <Group title="Formule" icon={PackageIcon}>
          {base.map((s) => <ActiveCard key={s.id} clientId={clientId} sub={s} title={s.label} />)}
        </Group>
      )}

      <Group title="Offres souscrites" icon={CheckIcon}>
        {actives.length === 0 ? <p className="px-1 text-sm text-text">Aucune offre du catalogue pour l’instant.</p> : actives.flatMap((o) => o.actives.map((s) => <ActiveCard key={s.id} clientId={clientId} sub={s} title={o.name} sub2={o.benefit} />))}
      </Group>

      {autres.length > 0 && (
        <Group title="À proposer" icon={ShoppingBagIcon}>
          {autres.map((o) => <OfferCard key={o.id} clientId={clientId} offer={o} sites={sites} />)}
        </Group>
      )}

      {resiliees.length > 0 && (
        <details className="rounded-card border border-border bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer text-text">{resiliees.length} résiliée{resiliees.length > 1 ? "s" : ""}</summary>
          <ul className="mt-2 space-y-1 text-xs text-text">{resiliees.map((r) => <li key={r.id}>{r.label} · {r.quand}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-card border p-3", accent ? "border-[#199e70]/40 bg-[#199e70]/10" : "border-border bg-surface")}>
      <p className={cn("font-title text-xl font-extrabold tabular-nums", accent ? "text-[#3fd39c]" : "text-title")}>{value}</p>
      <p className="text-xs text-text">{label}</p>
    </div>
  );
}

function Group({ title, icon: Icon, children }: { title: string; icon: typeof CheckIcon; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text uppercase"><Icon size={13} aria-hidden /> {title}</p>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ActiveCard({ clientId, sub, title, sub2 }: { clientId: string; sub: ActiveSub; title: string; sub2?: string }) {
  return (
    <div className="flex flex-col rounded-card border border-[#199e70]/40 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-title">{title}</p>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#199e70]/15 px-2 py-0.5 text-[11px] font-semibold text-[#3fd39c]"><CheckIcon size={11} /> Actif</span>
      </div>
      {sub2 && <p className="mt-0.5 line-clamp-2 text-xs text-text">{sub2}</p>}
      <p className="mt-3 font-title text-lg font-extrabold text-title">{sub.price}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-text">
        <li>Depuis le {sub.since}{sub.site ? ` · ${sub.site}` : ""}</li>
        {sub.quota ? <li>{sub.quota} modifications / mois</li> : null}
        {sub.endsAt ? <li>Engagement jusqu’au {sub.endsAt}</li> : null}
      </ul>
      <form action={cancelSubscription.bind(null, clientId, sub.id)} className="mt-3" onSubmit={(e) => { if (!confirm(`Résilier « ${title} » ?`)) e.preventDefault(); }}>
        <SubmitButton variant="ghost" size="sm" pendingLabel="…" className="px-0 text-xs text-text hover:text-pink">Résilier</SubmitButton>
      </form>
    </div>
  );
}

function OfferCard({ clientId, offer, sites }: { clientId: string; offer: OfferRow; sites: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(activateOffer.bind(null, clientId, offer.id), {});
  const besoinSite = !!offer.module || sites.length > 1;
  return (
    <div className={cn("flex flex-col rounded-card border border-dashed bg-surface/60 p-4", offer.commandee ? "border-pink/60" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-text-strong">{offer.name}</p>
        {offer.commandee ? <span className="shrink-0 rounded-full bg-pink/15 px-2 py-0.5 text-[11px] font-semibold text-pink">Commandée</span> : <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text">Non souscrite</span>}
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs text-text">{offer.benefit}</p>
      <p className="mt-3 text-sm font-semibold text-text-strong">{offer.price}{offer.module ? <span className="font-normal text-text"> · module {offer.module}</span> : null}</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-title hover:border-text">
          <PlusIcon size={13} /> Activer pour ce client
        </button>
      ) : (
        <form action={action} className="mt-3 space-y-2 rounded-card border border-border p-3">
          {besoinSite && (
            <Select name="siteId" defaultValue={sites.length === 1 ? sites[0].id : ""} required={!!offer.module} className="py-2 text-sm">
              {!offer.module && <option value="">Tous les sites</option>}
              {offer.module && sites.length !== 1 && <option value="" disabled>Choisir le site</option>}
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          {!besoinSite && sites.length === 1 && <input type="hidden" name="siteId" value={offer.module ? sites[0].id : ""} />}
          {offer.mensuel && (
            <Select name="commitmentMonths" defaultValue="0" className="py-2 text-sm">
              <option value="0">Sans engagement</option>
              <option value="6">Engagement 6 mois</option>
              <option value="12">Engagement 12 mois</option>
              <option value="24">Engagement 24 mois</option>
            </Select>
          )}
          <label className="flex items-center gap-2 text-xs text-text"><input type="checkbox" name="notify" className="accent-white" /> Prévenir le client</label>
          <FormError message={state.error} />
          <div className="flex items-center gap-2">
            <SubmitButton size="sm" pendingLabel="Activation…">Activer</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} aria-label="Annuler" className="flex size-9 items-center justify-center rounded-full border border-border text-text hover:text-title"><XIcon size={14} /></button>
          </div>
        </form>
      )}
    </div>
  );
}
