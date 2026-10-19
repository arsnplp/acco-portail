import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS, PROJECT_STEPS } from "@/lib/labels";
import { fmtDate, fmtPrice } from "@/lib/format";
import { ClientForms } from "./forms";
import { cancelSubscription, sendInvitation } from "../actions";
import { FolderOpen, ChevronRight } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";

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

  return (
    <AdminPage title={client.name} back={{ href: "/admin/clients", label: "Clients" }}>
      <SectionTitle emoji="🌐">Sites</SectionTitle>
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

      <SectionTitle emoji="💳">Abonnements et modules</SectionTitle>
      <div className="grid gap-2">
        {client.subscriptions.map((s) => (
          <Card key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold text-title">{s.label}</p>
              <p className="text-xs text-text">
                {s.site?.name ? `${s.site.name} · ` : ""}{fmtPrice(s.priceCents)}{s.billing === "MENSUEL" ? " / mois" : ""}
                {s.monthlyQuota ? ` · ${s.monthlyQuota} modif/mois` : ""}
                {s.commitmentEndsAt ? ` · engagement jusqu’au ${fmtDate(s.commitmentEndsAt)}` : ""}
              </p>
            </div>
            {s.status === "ACTIF" ? (
              <form action={cancelSubscription.bind(null, client.id, s.id)}>
                <SubmitButton variant="ghost" size="sm" pendingLabel="…">Résilier</SubmitButton>
              </form>
            ) : (
              <Badge tone="pink">Résilié</Badge>
            )}
          </Card>
        ))}
        {client.subscriptions.length === 0 && <p className="text-sm text-text">Aucun abonnement.</p>}
      </div>

      <SectionTitle emoji="👤">Accès du client</SectionTitle>
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

      <SectionTitle emoji="📄">Documents</SectionTitle>
      <Card href={`/admin/clients/${client.id}/documents`} className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3"><FolderOpen size={20} strokeWidth={1.5} className="text-text" /><div><p className="font-medium text-title">Espace documents</p><p className="text-xs text-text">{client.documents.length} document{client.documents.length > 1 ? "s" : ""}{pendingDocs > 0 ? ` · ${pendingDocs} attendu${pendingDocs > 1 ? "s" : ""} du client` : ""}</p></div></div>
        <div className="flex items-center gap-2">{pendingDocs > 0 && <Badge tone="yellow">{pendingDocs}</Badge>}<ChevronRight size={18} className="text-text" /></div>
      </Card>
      <div className="mt-3"><Card href={`/admin/messages/${client.id}`} className="py-3 text-sm font-medium text-title">💬 Voir les échanges avec ce client</Card></div>

      <ClientForms client={{ id: client.id, name: client.name, address: client.address, phone: client.phone, email: client.email, siren: client.siren }} sites={client.sites.map((s) => ({ id: s.id, name: s.name }))} />
    </AdminPage>
  );
}
