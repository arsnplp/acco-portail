import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtPrice, timeAgo } from "@/lib/format";
import { MODULE_LABEL } from "@/lib/offers";
import { validateOrder, refuseOrder } from "./actions";

export const metadata = { title: "Commandes" };

export default async function CommandesPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { client: { include: { sites: { select: { id: true, name: true } } } }, offer: true, site: { select: { name: true } }, validatedBy: { select: { firstName: true } } },
  });
  const todo = orders.filter((o) => o.status === "A_TRAITER");
  const done = orders.filter((o) => o.status !== "A_TRAITER");

  return (
    <AdminPage title="Commandes">
      <SectionTitle emoji="🛎️">À traiter ({todo.length})</SectionTitle>
      {todo.length === 0 ? <p className="text-sm text-text">Rien à traiter.</p> : (
        <MoreList title="Commandes à traiter" labels={todo.map((o) => `${o.client.name} ${o.offer.name}`)} className="grid gap-3" items={todo.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-title">{o.offer.name}</p>
                  <p className="text-xs text-text">{o.client.name}{o.site ? ` · ${o.site.name}` : ""} · {timeAgo(o.createdAt)} · {fmtPrice(o.offer.priceCents)}{o.offer.billing === "MENSUEL" ? " / mois" : ""}</p>
                  {o.note && <p className="mt-2 text-sm text-text-strong">« {o.note} »</p>}
                </div>
                <Badge tone="pink">À rappeler</Badge>
              </div>
              <form action={validateOrder.bind(null, o.id)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
                {o.offer.module !== "NONE" && (
                  <label className="text-xs text-text">Site ({MODULE_LABEL[o.offer.module]})
                    <Select name="siteId" defaultValue={o.siteId ?? ""} className="mt-1 py-2 text-sm">{o.client.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                  </label>
                )}
                {o.offer.billing === "MENSUEL" && (
                  <label className="text-xs text-text">Engagement (mois)<Input name="commitmentMonths" inputMode="numeric" defaultValue={12} className="mt-1 w-24 py-2 text-sm" /></label>
                )}
                <SubmitButton size="sm" pendingLabel="…">Valider et activer</SubmitButton>
              </form>
              <form action={refuseOrder.bind(null, o.id)} className="mt-2"><SubmitButton variant="ghost" size="sm" pendingLabel="…">Refuser / sans suite</SubmitButton></form>
            </Card>
          ))} />
      )}

      {done.length > 0 && (
        <>
          <SectionTitle emoji="🗂️">Historique</SectionTitle>
          <MoreList title="Historique des commandes" labels={done.map((o) => `${o.client.name} ${o.offer.name}`)} items={done.map((o) => (
              <Card key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate font-medium text-title">{o.offer.name}</p><p className="text-xs text-text">{o.client.name}{o.site ? ` · ${o.site.name}` : ""} · {o.validatedBy?.firstName ?? ""} · {timeAgo(o.validatedAt ?? o.createdAt)}</p></div>
                <Badge tone={o.status === "VALIDEE" ? "green" : "neutral"}>{o.status === "VALIDEE" ? "Validée" : "Refusée"}</Badge>
              </Card>
            ))} />
        </>
      )}
    </AdminPage>
  );
}
