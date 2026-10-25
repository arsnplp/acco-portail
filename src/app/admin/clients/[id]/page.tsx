import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS, PROJECT_STEPS } from "@/lib/labels";
import { fmtDate, fmtPrice } from "@/lib/format";
import { ClientForms } from "./forms";
import { OffresClient } from "./offres";
import { activePromo, MODULE_LABEL } from "@/lib/offers";
import { sendInvitation } from "../actions";
import { FolderOpen, ChevronRight } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { CreditCardIcon, FileTextIcon, GlobeIcon, UserIcon } from "lucide-react";
import { MessageSquareIcon } from "lucide-react";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sites: { orderBy: { createdAt: "asc" } },
      memberships: { include: { user: true } },
      subscriptions: { orderBy: { startedAt: "desc" }, include: { site: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      _count: { select: { orders: true, documentRequests: { where: { status: "EN_ATTENTE", direction: "VERS_CLIENT" } } } },
    },
  });
  if (!client) notFound();
  const pendingDocs = client._count.documentRequests;
  const [offers, orders] = await Promise.all([
    prisma.offer.findMany({ where: { OR: [{ isArchived: false }, { subscriptions: { some: { clientId: client.id, status: "ACTIF" } } }] }, orderBy: { order: "asc" }, include: { promotions: true } }),
    prisma.order.findMany({ where: { clientId: client.id, status: "A_TRAITER" }, select: { offerId: true } }),
  ]);
  const commandes = new Set(orders.map((o) => o.offerId));
  const actives = client.subscriptions.filter((s) => s.status === "ACTIF");
  const mensuel = actives.filter((s) => s.billing === "MENSUEL").reduce((a, s) => a + s.priceCents, 0);
  const ponctuel = actives.filter((s) => s.billing !== "MENSUEL").reduce((a, s) => a + s.priceCents, 0);
  const toActive = (s: (typeof actives)[number]) => ({
    id: s.id, label: s.label, price: `${fmtPrice(s.priceCents)}${s.billing === "MENSUEL" ? " / mois" : ""}`, since: fmtDate(s.startedAt),
    site: s.site?.name ?? null, endsAt: s.commitmentEndsAt ? fmtDate(s.commitmentEndsAt) : null, quota: s.monthlyQuota,
  });

  return (
    <AdminPage title={client.name} back={{ href: "/admin/clients", label: "Clients" }}>
      <SectionTitle icon={GlobeIcon}>Sites</SectionTitle>
      <div className="grid gap-2">
        {client.sites.map((s) => (
          <Card key={s.id} href={`/admin/sites/${s.id}`} className="flex items-center justify-between py-3">
            <div>
              <p className="font-semibold text-title">{s.name}</p>
              <p className="text-xs text-text">{s.status === "EN_CREATION" ? `Étape : ${PROJECT_STEPS.find((p) => p.key === s.projectStep)?.label}` : s.url}</p>
            </div>
            <Badge tone={SITE_STATUS[s.status].tone}>{SITE_STATUS[s.status].label}</Badge>
          </Card>
        ))}
      </div>

      <SectionTitle icon={CreditCardIcon}>Offres et abonnements</SectionTitle>
      <OffresClient
        clientId={client.id}
        totaux={{ actives: actives.length, mensuel: fmtPrice(mensuel), ponctuel: fmtPrice(ponctuel) }}
        base={actives.filter((s) => !s.offerId).map(toActive)}
        offres={offers.map((o) => ({
          id: o.id, name: o.name, benefit: o.benefit, mensuel: o.billing === "MENSUEL",
          price: `${fmtPrice(activePromo(o)?.price ?? o.priceCents)}${o.billing === "MENSUEL" ? " / mois" : ""}${o.setupCents ? ` + ${fmtPrice(o.setupCents)} à l’installation` : ""}`,
          module: o.module !== "NONE" ? MODULE_LABEL[o.module] : null,
          actives: actives.filter((s) => s.offerId === o.id).map(toActive),
          commandee: commandes.has(o.id),
        }))}
        resiliees={client.subscriptions.filter((s) => s.status === "RESILIE").map((s) => ({ id: s.id, label: s.label, quand: s.cancelledAt ? `résiliée le ${fmtDate(s.cancelledAt)}` : "résiliée" }))}
        sites={client.sites.map((s) => ({ id: s.id, name: s.name }))}
      />

      <SectionTitle icon={UserIcon}>Accès du client</SectionTitle>
      <div className="grid gap-2">
        {client.memberships.map((m) => (
          <Card key={m.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-title">{[m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email}</p>
              <p className="text-xs text-text">{m.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={m.role === "OWNER" ? "blue" : "neutral"}>{m.role === "OWNER" ? "Gérant" : "Membre"}</Badge>
              <form action={sendInvitation.bind(null, client.id, m.userId)}><SubmitButton variant="secondary" size="sm" pendingLabel="Envoi…">Envoyer l’invitation</SubmitButton></form>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle icon={FileTextIcon}>Documents</SectionTitle>
      <Card href={`/admin/clients/${client.id}/documents`} className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3"><FolderOpen size={20} strokeWidth={1.5} className="text-text" /><div><p className="font-medium text-title">Espace documents</p><p className="text-xs text-text">{client.documents.length} document{client.documents.length > 1 ? "s" : ""}{pendingDocs > 0 ? ` · ${pendingDocs} attendu${pendingDocs > 1 ? "s" : ""} du client` : ""}</p></div></div>
        <div className="flex items-center gap-2">{pendingDocs > 0 && <Badge tone="yellow">{pendingDocs}</Badge>}<ChevronRight size={18} className="text-text" /></div>
      </Card>
      <div className="mt-3"><Card href={`/admin/messages/${client.id}`} className="flex items-center gap-2 py-3 text-sm font-medium text-title"><MessageSquareIcon size={16} strokeWidth={1.75} className="text-text" aria-hidden /> Voir les échanges avec ce client</Card></div>

      <ClientForms client={{ id: client.id, name: client.name, address: client.address, phone: client.phone, email: client.email, siren: client.siren }} sites={client.sites.map((s) => ({ id: s.id, name: s.name }))} />
    </AdminPage>
  );
}
