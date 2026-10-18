"use client";

import { useActionState, useState } from "react";
import { Check, Clock } from "lucide-react";
import type { Billing, Module } from "@prisma/client";
import { orderOffer, type OrderState } from "./actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtPrice, fmtDateShort } from "@/lib/format";

type Props = {
  offer: { id: string; slug: string; name: string; benefit: string; description: string | null; priceCents: number; setupCents: number | null; billing: Billing; module: Module };
  promo: { price: number; label: string; endsAt: Date } | null;
  active: boolean;
  pending: boolean;
  sites: { id: string; name: string }[];
};

export function OfferCard({ offer, promo, active, pending, sites }: Props) {
  const [state, action] = useActionState<OrderState, FormData>(orderOffer.bind(null, offer.id), {});
  const [open, setOpen] = useState(false);
  const needsSite = offer.module !== "NONE" && sites.length > 1;
  const per = offer.billing === "MENSUEL" ? " / mois" : "";
  const done = state.ok || pending;

  return (
    <Card id={offer.slug} className={promo ? "border-yellow/50" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-title text-lg font-extrabold text-title">{offer.name}</p>
          <p className="mt-0.5 text-sm text-text">{offer.benefit}</p>
        </div>
        {active && <Badge tone="green">Actif</Badge>}
        {!active && promo && <Badge tone="yellow">{promo.label}</Badge>}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        {promo ? (
          <>
            <span className="text-sm text-muted line-through">{fmtPrice(offer.priceCents)}</span>
            <span className="font-title text-2xl font-extrabold text-title">{fmtPrice(promo.price)}</span>
          </>
        ) : (
          <span className="font-title text-2xl font-extrabold text-title">{fmtPrice(offer.priceCents)}</span>
        )}
        <span className="text-sm text-text">{per}</span>
        {offer.setupCents ? <span className="text-xs text-text">+ {fmtPrice(offer.setupCents)} une fois</span> : null}
      </div>
      {promo && <p className="mt-1 flex items-center gap-1 text-xs text-yellow"><Clock size={12} /> Jusqu’au {fmtDateShort(promo.endsAt)}</p>}
      {offer.description && <p className="mt-3 text-sm text-text-strong">{offer.description}</p>}

      <div className="mt-4">
        {active ? (
          <p className="flex items-center gap-2 text-sm text-green"><Check size={16} /> Vous en profitez déjà</p>
        ) : done ? (
          <p className="flex items-center gap-2 text-sm text-blue"><Check size={16} /> Demande envoyée, on vous rappelle vite</p>
        ) : !open && needsSite ? (
          <Button className="w-full" onClick={() => setOpen(true)}>Ça m’intéresse</Button>
        ) : (
          <form action={action} className="space-y-3">
            {needsSite ? (
              <Select name="siteId" defaultValue={sites[0]?.id}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            ) : (
              sites[0] && <input type="hidden" name="siteId" value={sites[0].id} />
            )}
            <FormError message={state.error} />
            <SubmitButton className="w-full" pendingLabel="Envoi…">Ça m’intéresse</SubmitButton>
          </form>
        )}
      </div>
    </Card>
  );
}
