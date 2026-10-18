import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CHANGE_STATUS, SITE_STATUS } from "@/lib/labels";
import { fmtDateShort } from "@/lib/format";
import { SiteForms } from "./forms";
import { addAssetRequest } from "../actions";

export default async function SiteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      client: true,
      assets: { orderBy: { createdAt: "asc" } },
      history: { orderBy: { happenedAt: "desc" } },
      changeRequests: { where: { status: { not: "TERMINEE" } }, orderBy: { createdAt: "desc" } },
      subscriptions: { where: { status: "ACTIF" } },
    },
  });
  if (!site) notFound();

  return (
    <AdminPage title={site.name} back={{ href: `/admin/clients/${site.clientId}`, label: site.client.name }} action={<Badge tone={SITE_STATUS[site.status].tone}>{SITE_STATUS[site.status].label}</Badge>}>
      <SectionTitle emoji="🔑">Clé formulaire</SectionTitle>
      <Card className="py-3"><code className="text-sm text-text-strong break-all">{site.siteKey}</code><p className="mt-1 text-xs text-muted">À utiliser dans le snippet de formulaire (étape 5).</p></Card>

      <SectionTitle emoji="🧩">Modules actifs</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {site.subscriptions.length === 0 && <p className="text-sm text-text">Aucun abonnement actif sur ce site.</p>}
        {site.subscriptions.map((s) => <Badge key={s.id} tone={s.module === "NONE" ? "neutral" : "green"}>{s.label}</Badge>)}
      </div>

      {site.changeRequests.length > 0 && (
        <>
          <SectionTitle emoji="🛠️">Modifications ouvertes</SectionTitle>
          <div className="grid gap-2">
            {site.changeRequests.map((r) => (
              <Card key={r.id} href="/admin/modifications" className="flex items-center justify-between py-3">
                <p className="font-medium text-title">{r.title}</p>
                <Badge tone={CHANGE_STATUS[r.status].tone}>{CHANGE_STATUS[r.status].label}</Badge>
              </Card>
            ))}
          </div>
        </>
      )}

      <SiteForms site={{ id: site.id, name: site.name, url: site.url, previewUrl: site.previewUrl, screenshotUrl: site.screenshotUrl, status: site.status, projectStep: site.projectStep, searchConsoleProp: site.searchConsoleProp, googleLocationId: site.googleLocationId }} />

      {site.status === "EN_CREATION" && (
        <>
          <SectionTitle emoji="📎">Éléments demandés au client</SectionTitle>
          <div className="grid gap-2">
            {site.assets.map((a) => (
              <Card key={a.id} className="flex items-center justify-between py-3">
                <p className="text-sm text-title">{a.label}</p>
                {a.storagePath ? <Badge tone="green">Reçu {fmtDateShort(a.uploadedAt!)}</Badge> : <Badge tone="yellow">En attente</Badge>}
              </Card>
            ))}
            <form action={addAssetRequest.bind(null, site.id)} className="flex gap-2">
              <Input name="label" placeholder="Nouvel élément à demander" required />
              <Select name="kind" defaultValue="AUTRE" className="w-32"><option value="LOGO">Logo</option><option value="TEXTE">Texte</option><option value="PHOTO">Photo</option><option value="AUTRE">Autre</option></Select>
              <SubmitButton size="md" variant="secondary">Ajouter</SubmitButton>
            </form>
          </div>
        </>
      )}

      <SectionTitle emoji="🕓">Historique</SectionTitle>
      {site.history.length === 0 ? <p className="text-sm text-text">Vide.</p> : (
        <Timeline items={site.history.map((h) => ({ id: h.id, date: h.happenedAt, title: h.title, description: h.description, items: h.items, tone: h.kind === "CREATION" ? "blue" : h.kind === "MISE_EN_LIGNE" ? "green" : "neutral" }))} />
      )}
    </AdminPage>
  );
}
