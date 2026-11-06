import Link from "next/link";
import { FileSignatureIcon, PackageIcon, PlusIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtPrice } from "@/lib/format";
import { teamName } from "@/lib/crm";
import { CONTRAT_STATUT, MOYEN_PAIEMENT_LABEL } from "@/lib/contrats";
import { activePromo, MODULE_LABEL } from "@/lib/offers";
import { OffresClient } from "../offres";
import { PaiementButtons, SubscriptionForm } from "../forms";
import type { Ctx } from "./ctx";

/** Onglet Contrats et abonnements (4.3) : tous les contrats (statut, offres, dates, avenants), puis les abonnements actifs ; le générateur commun pour un nouveau contrat avec ce client. */
export async function ContratsOnglet({ clientId, finance }: Ctx) {
  const [client, offers, orders] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, include: {
      contrats: { orderBy: { createdAt: "desc" }, include: { lignes: { orderBy: { ordre: "asc" }, include: { site: { select: { name: true } } } }, site: { select: { name: true } }, commercial: { select: { firstName: true, email: true } }, avenants: { select: { id: true, reference: true, statut: true } } } },
      subscriptions: { orderBy: { startedAt: "desc" }, include: { site: { select: { name: true } } } },
      sites: { select: { id: true, name: true } },
    } }),
    prisma.offer.findMany({ where: { OR: [{ isArchived: false }, { subscriptions: { some: { clientId, status: "ACTIF" } } }] }, orderBy: { order: "asc" }, include: { promotions: true, parent: { select: { name: true } } } }),
    prisma.order.findMany({ where: { clientId, status: "A_TRAITER" }, select: { offerId: true } }),
  ]);
  const commandes = new Set(orders.map((o) => o.offerId));
  const actives = client.subscriptions.filter((s) => s.status === "ACTIF");
  const mensuel = actives.filter((s) => s.billing === "MENSUEL").reduce((a, s) => a + s.priceCents, 0);
  const ponctuel = actives.filter((s) => s.billing !== "MENSUEL").reduce((a, s) => a + s.priceCents, 0);
  const toActive = (s: (typeof actives)[number]) => ({ id: s.id, label: s.label, price: `${fmtPrice(s.priceCents)}${s.billing === "MENSUEL" ? " / mois" : ""}`, since: fmtDate(s.startedAt), site: s.site?.name ?? null, endsAt: s.commitmentEndsAt ? fmtDate(s.commitmentEndsAt) : null, quota: s.monthlyQuota });
  const principaux = client.contrats.filter((c) => !c.parentId);
  return (
    <div className="space-y-6">
      <SectionTitle icon={FileSignatureIcon} action={<Button href={`/admin/contrats/nouveau?client=${clientId}`} size="sm"><PlusIcon size={14} /> Nouveau contrat</Button>}>Contrats ({client.contrats.length})</SectionTitle>
      {client.contrats.length === 0 ? <p className="text-sm text-text">Aucun contrat pour ce client. Le générateur commun crée un contrat rattaché à cette fiche, sans doublon.</p> : (
        <div className="grid gap-3">
          {principaux.map((c) => (
            <Card key={c.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/contrats/${c.id}`} className="font-semibold text-title hover:underline">{c.reference}</Link>
                <Badge tone={CONTRAT_STATUT[c.statut].tone}>{CONTRAT_STATUT[c.statut].label}</Badge>
                {c.formule && <Badge tone="blue">{c.formule}</Badge>}
                <span className="text-xs text-text">{c.titre}{c.site ? ` · ${c.site.name}` : ""}{c.commercial ? ` · ${teamName(c.commercial)}` : ""}</span>
              </div>
              <p className="mt-1 text-sm text-text-strong">
                {finance ? <>{fmtPrice(c.montantMensuelHt)} HT / mois{c.montantPonctuelHt ? ` + ${fmtPrice(c.montantPonctuelHt)} ponctuel` : ""} · </> : null}
                engagement {c.dureeMois} mois{c.debutEngagement ? ` du ${fmtDate(c.debutEngagement)}` : ""}{c.finEngagement ? ` au ${fmtDate(c.finEngagement)}` : ""}{c.jourPrelevement ? ` · prélevé le ${c.jourPrelevement} de chaque mois` : ""} · reconduction {c.reconductionMois} mois · préavis {c.preavisJours} j
              </p>
              <p className="text-xs text-text">{c.signeAt ? `Signé le ${fmtDate(c.signeAt)}${c.signataireNom ? ` par ${c.signataireNom}` : ""}` : c.envoyeAt ? `Envoyé le ${fmtDate(c.envoyeAt)}` : "Brouillon"}{c.moyenPaiement ? ` · ${MOYEN_PAIEMENT_LABEL[c.moyenPaiement]}` : ""}{c.scanPath ? " · scan signé joint" : ""}</p>
              {c.lignes.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-text">{c.lignes.map((l) => <li key={l.id}>{l.libelle}{l.site ? ` → ${l.site.name}` : ""}{finance ? ` · ${fmtPrice(l.montantHt)}${l.billing === "MENSUEL" ? " / mois" : ""}` : ""}</li>)}</ul>}
              {c.avenants.length > 0 && <p className="mt-1 text-xs text-text">Avenants : {c.avenants.map((a) => <Link key={a.id} href={`/admin/contrats/${a.id}`} className="mr-2 text-title hover:underline">{a.reference} ({CONTRAT_STATUT[a.statut].label})</Link>)}</p>}
              {finance && c.statut === "SIGNE" && <div className="mt-2"><PaiementButtons contratId={c.id} premierPaiement={!!c.premierPaiementAt} impaye={!!c.impayeAt && !c.regulariseAt} /></div>}
            </Card>
          ))}
        </div>
      )}

      <SectionTitle icon={PackageIcon}>Abonnements et options</SectionTitle>
      <OffresClient
        clientId={clientId}
        totaux={{ actives: actives.length, mensuel: fmtPrice(mensuel), ponctuel: fmtPrice(ponctuel) }}
        base={actives.filter((s) => !s.offerId).map(toActive)}
        offres={offers.map((o) => ({
          id: o.id, name: o.name, benefit: o.benefit, mensuel: o.billing === "MENSUEL",
          price: `${fmtPrice(activePromo(o)?.price ?? o.priceCents)}${o.billing === "MENSUEL" ? " / mois" : ""}${o.setupCents ? ` + ${fmtPrice(o.setupCents)} à l’installation` : ""}`,
          module: o.module !== "NONE" ? MODULE_LABEL[o.module] : null,
          actives: actives.filter((s) => s.offerId === o.id).map(toActive),
          commandee: commandes.has(o.id), parentId: o.parentId, parentName: o.parent?.name ?? null,
        }))}
        resiliees={client.subscriptions.filter((s) => s.status === "RESILIE").map((s) => ({ id: s.id, label: s.label, quand: s.cancelledAt ? `résiliée le ${fmtDate(s.cancelledAt)}` : "résiliée" }))}
        sites={client.sites}
        finance={finance}
      />
      {finance && <SubscriptionForm clientId={clientId} sites={client.sites} />}
    </div>
  );
}
