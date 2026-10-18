import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { DocumentSections } from "@/components/documents/list";
import { UploadDocumentForm } from "@/app/admin/documents/upload-form";
import { closeRequest, deleteDocument } from "@/app/admin/documents/actions";
import { DOC_KIND, requestLabel } from "@/lib/documents";
import { fmtDate, timeAgo } from "@/lib/format";

export default async function ClientDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sites: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" }, include: { site: { select: { name: true } } } },
      documentRequests: { orderBy: { createdAt: "desc" }, include: { requester: { select: { firstName: true } }, site: { select: { name: true } }, document: { select: { title: true } } } },
    },
  });
  if (!client) notFound();
  const pending = client.documentRequests.filter((r) => r.status === "EN_ATTENTE");
  const done = client.documentRequests.filter((r) => r.status === "TERMINEE").slice(0, 10);
  const sites = client.sites;

  return (
    <AdminPage title="Documents" back={{ href: `/admin/clients/${client.id}`, label: client.name }} action={pending.length > 0 ? <Badge tone="pink">{pending.length} demande{pending.length > 1 ? "s" : ""} en attente</Badge> : undefined}>
      <SectionTitle emoji="⏳">Demandes en attente</SectionTitle>
      {pending.length === 0 ? <p className="text-sm text-text">Aucune demande en attente.</p> : (
        <div className="grid gap-3">
          {pending.map((r) => (
            <Card key={r.id} className="border-yellow/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-title">{requestLabel(r)}</p>
                  <p className="text-xs text-text">Demandé par {r.requester?.firstName ?? "le client"} {timeAgo(r.createdAt)}{r.site ? ` · ${r.site.name}` : ""}</p>
                </div>
                <form action={closeRequest.bind(null, r.id)}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Clore sans fichier</SubmitButton></form>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <UploadDocumentForm clientId={client.id} sites={sites} compact submitLabel="Envoyer ce document" defaults={{ kind: r.kind, siteId: r.siteId, requestId: r.id, title: r.kind === "AUTRE" ? (r.message ?? "") : `${DOC_KIND[r.kind].label}${r.message ? ` — ${r.message}` : ""}` }} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle emoji="⬆️">Déposer un document</SectionTitle>
      <UploadDocumentForm clientId={client.id} sites={sites} />

      <SectionTitle emoji="📄">Documents du client</SectionTitle>
      <DocumentSections
        documents={client.documents}
        emptyText="Aucun document déposé pour ce client."
        renderAction={(d) => (
          <form action={deleteDocument.bind(null, d.id)}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Supprimer</SubmitButton></form>
        )}
      />

      {done.length > 0 && (
        <>
          <SectionTitle emoji="✅">Demandes terminées</SectionTitle>
          <div className="grid gap-2">
            {done.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm text-text-strong">{requestLabel(r)}</p><p className="text-xs text-muted">{r.document ? `Envoyé : ${r.document.title}` : "Close sans fichier"} · {r.fulfilledAt ? fmtDate(r.fulfilledAt) : ""}</p></div>
                <Badge tone="green">Terminée</Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </AdminPage>
  );
}
