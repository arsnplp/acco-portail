import Link from "next/link";
import { InboxIcon, PencilRulerIcon, ShoppingCartIcon, WrenchIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHANGE_STATUS, CONTACT_STATUS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { fmtDayTime } from "@/lib/crm";
import type { Ctx } from "./ctx";

/** Onglet Demandes / Interventions / Commandes (4.3) : tickets, modifications, commandes du portail, formulaires de contact du site, interventions réalisées. */
export async function DemandesOnglet({ clientId }: Ctx) {
  const [modifs, orders, contacts, interventions] = await Promise.all([
    prisma.changeRequest.findMany({ where: { site: { clientId } }, orderBy: { createdAt: "desc" }, take: 60, include: { site: { select: { name: true } }, assignee: { select: { firstName: true, email: true } } } }),
    prisma.order.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 30, include: { offer: { select: { name: true } }, site: { select: { name: true } } } }),
    prisma.contactRequest.findMany({ where: { site: { clientId } }, orderBy: { createdAt: "desc" }, take: 30, include: { site: { select: { name: true } } } }),
    prisma.siteHistoryEntry.findMany({ where: { site: { clientId } }, orderBy: { happenedAt: "desc" }, take: 40, include: { site: { select: { name: true } } } }),
  ]);
  const ORDER = { A_TRAITER: ["À traiter", "yellow"], VALIDEE: ["Validée", "green"], REFUSEE: ["Refusée", "neutral"] } as const;
  return (
    <div className="space-y-6">
      <SectionTitle icon={PencilRulerIcon} action={<Link href="/admin/modifications" className="text-sm text-text hover:text-title">Tableau des modifications</Link>}>Demandes de modification ({modifs.length})</SectionTitle>
      {modifs.length === 0 ? <p className="text-sm text-text">Aucune demande.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {modifs.map((r) => <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium text-title">{r.title}</p><p className="truncate text-xs text-text">{r.site.name} · {fmtDate(r.createdAt)}{r.urgency === "URGENTE" ? " · urgent" : ""}{r.assignee ? ` · ${r.assignee.firstName ?? r.assignee.email}` : ""}{r.completedAt ? ` · terminée le ${fmtDate(r.completedAt)}` : ""}</p></div><Badge tone={CHANGE_STATUS[r.status].tone}>{CHANGE_STATUS[r.status].label}</Badge></li>)}
        </ul>
      )}
      <SectionTitle icon={ShoppingCartIcon} action={<Link href="/admin/commandes" className="text-sm text-text hover:text-title">Commandes</Link>}>Commandes depuis le portail ({orders.length})</SectionTitle>
      {orders.length === 0 ? <p className="text-sm text-text">Aucune commande.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {orders.map((o) => <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium text-title">{o.offer.name}{o.site ? ` pour ${o.site.name}` : ""}</p><p className="truncate text-xs text-text">{fmtDate(o.createdAt)}{o.note ? ` · ${o.note}` : ""}</p></div><Badge tone={ORDER[o.status][1]}>{ORDER[o.status][0]}</Badge></li>)}
        </ul>
      )}
      <SectionTitle icon={InboxIcon}>Formulaires du site ({contacts.length})</SectionTitle>
      {contacts.length === 0 ? <p className="text-sm text-text">Aucune demande reçue par les formulaires des sites.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {contacts.map((c) => <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium text-title">{c.name}{c.type ? ` · ${c.type}` : ""}</p><p className="truncate text-xs text-text">{c.site.name} · {fmtDayTime(c.createdAt)} · {c.message.slice(0, 100)}</p></div><Badge tone={CONTACT_STATUS[c.status].tone}>{CONTACT_STATUS[c.status].label}</Badge></li>)}
        </ul>
      )}
      <SectionTitle icon={WrenchIcon}>Interventions réalisées ({interventions.length})</SectionTitle>
      {interventions.length === 0 ? <p className="text-sm text-text">Aucune intervention enregistrée.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
          {interventions.map((h) => <li key={h.id} className="px-4 py-2"><p className="text-title">{h.title} <span className="text-xs text-text">· {h.site.name} · {fmtDate(h.happenedAt)}</span></p>{(h.description || h.items.length > 0) && <p className="text-xs text-text">{[h.description, ...h.items].filter(Boolean).join(" · ")}</p>}</li>)}
        </ul>
      )}
    </div>
  );
}
