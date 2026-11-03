import Link from "next/link";
import { GlobeIcon, ShoppingBagIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHANGE_STATUS, SITE_STATUS, stepLabel } from "@/lib/labels";
import { fmtDate, fmtPrice } from "@/lib/format";
import { teamName } from "@/lib/crm";
import { CONTRAT_STATUT } from "@/lib/contrats";
import { activePromo } from "@/lib/offers";
import { ProposerButton, SiteCreateForm } from "../forms";
import type { Ctx } from "./ctx";

/** Onglet Sites (4.3, 4.4) : chaque site avec ses options réellement souscrites, son contrat, ses demandes, et une zone « À proposer » propre au site. */
export async function SitesOnglet({ clientId, finance, externe }: Ctx) {
  const [sites, offres, communes] = await Promise.all([
    prisma.site.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, include: {
      developpeur: { select: { firstName: true, email: true } },
      subscriptions: { where: { status: "ACTIF" }, include: { offer: { select: { name: true, parentId: true } } } },
      lignesContrat: { include: { contrat: { select: { id: true, reference: true, statut: true } } } },
      changeRequests: { where: { status: { not: "TERMINEE" } }, orderBy: { createdAt: "desc" }, take: 5 },
      history: { orderBy: { happenedAt: "desc" }, take: 3 },
      contrats: { select: { id: true, reference: true, statut: true, parentId: true } },
      _count: { select: { changeRequests: true, articles: true } },
    } }),
    externe ? [] : prisma.offer.findMany({ where: { isArchived: false }, orderBy: { order: "asc" }, include: { promotions: true, parent: { select: { name: true } } } }),
    prisma.subscription.findMany({ where: { clientId, siteId: null, status: "ACTIF" }, include: { offer: { select: { name: true, parentId: true } } } }),
  ]);
  return (
    <div className="space-y-5">
      {sites.length === 0 && <p className="text-sm text-text">Aucun site pour ce client.</p>}
      {sites.map((s) => {
        const toutes = [...s.subscriptions, ...communes]; // options du site + options « tous les sites »
        const actifs = new Set(toutes.map((x) => x.offerId).filter((x): x is string => !!x));
        const contratRef = s.contratId ? s.contrats.find((c) => c.id === s.contratId) : null;
        const aProposer = offres.filter((o) => !actifs.has(o.id) && (o.parentId ? actifs.has(o.parentId) || s.status === "EN_LIGNE" : !toutes.length));
        return (
          <section key={s.id} className="rounded-card border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/sites/${s.id}`} className="font-semibold text-title hover:underline">{s.name}</Link>
                <p className="truncate text-xs text-text">{s.url ?? s.previewUrl ?? "pas d’adresse"} · {s.status === "EN_CREATION" ? `étape ${stepLabel(s.projectStep)} (V${s.version})` : s.status === "EN_LIGNE" ? `en ligne${s.launchedAt ? ` depuis le ${fmtDate(s.launchedAt)}` : ""}` : "suspendu"} · développeur : {s.developpeur ? teamName(s.developpeur) : "non attribué"}</p>
              </div>
              <Badge tone={SITE_STATUS[s.status].tone}>{SITE_STATUS[s.status].label}</Badge>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-text uppercase">Options souscrites sur ce site</p>
                {toutes.length === 0 ? <p className="mt-1 text-sm text-text">Aucune option active sur ce site.</p> : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {toutes.map((x) => <li key={x.id} className="text-text-strong">{x.label}{!x.siteId ? " (tous les sites)" : ""}{finance ? ` · ${fmtPrice(x.priceCents)}${x.billing === "MENSUEL" ? " / mois" : ""}` : ""}{x.commitmentEndsAt ? ` · jusqu’au ${fmtDate(x.commitmentEndsAt)}` : ""}{x.monthlyQuota ? ` · ${x.monthlyQuota} modifs / mois` : ""}</li>)}
                  </ul>
                )}
                <p className="mt-3 text-xs font-semibold tracking-wide text-text uppercase">Contrats</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {contratRef && <li><Link href={`/admin/contrats/${contratRef.id}`} className="text-title hover:underline">{contratRef.reference}</Link> <Badge tone={CONTRAT_STATUT[contratRef.statut].tone}>{CONTRAT_STATUT[contratRef.statut].label}</Badge> <span className="text-xs text-text">contrat de référence</span></li>}
                  {s.contrats.filter((c) => c.id !== s.contratId).map((c) => <li key={c.id}><Link href={`/admin/contrats/${c.id}`} className="text-title hover:underline">{c.reference}</Link> <Badge tone={CONTRAT_STATUT[c.statut].tone}>{CONTRAT_STATUT[c.statut].label}</Badge>{c.parentId ? <span className="text-xs text-text"> avenant</span> : null}</li>)}
                  {s.contrats.length === 0 && !contratRef && <li className="text-text">Aucun contrat lié.</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-text uppercase">Demandes et interventions</p>
                {s.changeRequests.length === 0 ? <p className="mt-1 text-sm text-text">Aucune demande ouverte.</p> : (
                  <ul className="mt-1 space-y-1 text-sm">{s.changeRequests.map((r) => <li key={r.id} className="flex items-center gap-2"><span className="truncate text-text-strong">{r.title}</span><Badge tone={CHANGE_STATUS[r.status].tone}>{CHANGE_STATUS[r.status].label}</Badge></li>)}</ul>
                )}
                {s.history.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-text">{s.history.map((h) => <li key={h.id}>{fmtDate(h.happenedAt)} · {h.title}</li>)}</ul>}
                <p className="mt-2 text-xs text-text">{s._count.changeRequests} demande{s._count.changeRequests > 1 ? "s" : ""} au total · {s._count.articles} article{s._count.articles > 1 ? "s" : ""}</p>
              </div>
            </div>
            {!externe && aProposer.length > 0 && (
              <div className="border-t border-dashed border-border px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text uppercase"><ShoppingBagIcon size={13} aria-hidden /> À proposer pour {s.name}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {aProposer.map((o) => <li key={o.id}><ProposerButton clientId={clientId} siteId={s.id} offerId={o.id} label={`${o.name} · ${fmtPrice(activePromo(o)?.price ?? o.priceCents)}${o.billing === "MENSUEL" ? " / mois" : ""}`} /></li>)}
                </ul>
                <p className="mt-1.5 text-[11px] text-muted">Une proposition prépare un contrat (ou un avenant) brouillon pour ce site précis : rien n’est facturé sans signature.</p>
              </div>
            )}
          </section>
        );
      })}
      {!externe && <><SectionTitle icon={GlobeIcon}>Ajouter un site</SectionTitle><SiteCreateForm clientId={clientId} /></>}
    </div>
  );
}
