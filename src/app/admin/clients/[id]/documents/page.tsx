import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { DocumentSections } from "@/components/documents/list";
import { UploadDocumentForm } from "@/app/admin/documents/upload-form";
import { AskClientDocumentForm } from "@/app/admin/documents/ask-form";
import { closeRequest, cancelRequest, deleteDocument } from "@/app/admin/documents/actions";
import { DOC_KIND, requestLabel } from "@/lib/documents";
import { fmtDate, timeAgo } from "@/lib/format";

export default async function ClientDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sites: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" }, include: { site: { select: { name: true } } } },
      documentRequests: { orderBy: { createdAt: "desc" }, include: { requester: { select: { firstName: true } }, site: { select: { name: true } }, document: { select: { title: true, createdAt: true } } } },
    },
  });
  if (!client) notFound();
  const fromClient = client.documentRequests.filter((r) => r.direction === "VERS_EQUIPE" && r.status === "EN_ATTENTE");
  const awaitingClient = client.documentRequests.filter((r) => r.direction === "VERS_CLIENT" && r.status === "EN_ATTENTE");
  const done = client.documentRequests.filter((r) => r.status === "TERMINEE").slice(0, 12);
  const sites = client.sites;
  const badge = fromClient.length > 0 ? <Badge tone="pink">{fromClient.length} à traiter</Badge> : awaitingClient.length > 0 ? <Badge tone="yellow">{awaitingClient.length} attendu{awaitingClient.length > 1 ? "s" : ""} du client</Badge> : undefined;

  return (
    <AdminPage title="Documents" back={{ href: `/admin/clients/${client.id}`, label: client.name }} action={badge}>
      <SectionTitle emoji="📥">Le client vous demande</SectionTitle>
      {fromClient.length === 0 ? <p className="text-sm text-text">Aucune demande en attente.</p> : (
        <div className="grid gap-3">
          {fromClient.map((r) => (
            <Card key={r.id} className="border-pink/40">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold text-title">{requestLabel(r)}</p><p className="text-xs text-text">Demandé par {r.requester?.firstName ?? "le client"} {timeAgo(r.createdAt)}{r.site ? ` · ${r.site.name}` : ""}</p></div>
                <form action={closeRequest.bind(null, r.id)}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Clore sans fichier</SubmitButton></form>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <UploadDocumentForm clientId={client.id} sites={sites} compact submitLabel="Envoyer ce document" defaults={{ kind: r.kind, siteId: r.siteId, requestId: r.id, title: r.kind === "AUTRE" ? (r.message ?? "") : `${DOC_KIND[r.kind].label}${r.message ? ` — ${r.message}` : ""}` }} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle emoji="📤">Vous attendez du client</SectionTitle>
      <div className="grid gap-2">
        {awaitingClient.map((r) => (
          <Card key={r.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="truncate font-medium text-title">{r.message}</p><p className="text-xs text-text">Demandé par {r.requester?.firstName ?? "Acco"} {timeAgo(r.createdAt)}{r.site ? ` · ${r.site.name}` : ""}</p></div>
            <div className="flex items-center gap-2"><Badge tone="yellow">En attente</Badge><form action={cancelRequest.bind(null, r.id)}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Annuler</SubmitButton></form></div>
          </Card>
        ))}
        <AskClientDocumentForm clientId={client.id} sites={sites} />
      </div>

      <SectionTitle emoji="⬆️">Déposer un document pour le client</SectionTitle>
      <UploadDocumentForm clientId={client.id} sites={sites} />

      <SectionTitle emoji="📄">Documents du client</SectionTitle>
      <DocumentSections
        documents={client.documents}
        emptyText="Aucun document pour ce client."
        renderAction={(d) => (
          <>
            {d.uploadedByClient && <Badge tone="blue">Déposé par le client</Badge>}
            <form action={deleteDocument.bind(null, d.id)}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Supprimer</SubmitButton></form>
          </>
        )}
      />

      {done.length > 0 && (
        <>
          <SectionTitle emoji="✅">Terminées</SectionTitle>
          <div className="grid gap-2">
            {done.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-strong">{r.direction === "VERS_CLIENT" ? r.message : requestLabel(r)}</p>
                  <p className="text-xs text-muted">
                    {r.direction === "VERS_CLIENT" ? (r.document ? `Déposé par le client le ${fmtDate(r.document.createdAt)}` : "Annulée") : r.document ? `Envoyé : ${r.document.title}` : "Close sans fichier"}
                    {r.fulfilledAt && r.direction !== "VERS_CLIENT" ? ` · ${fmtDate(r.fulfilledAt)}` : ""}
                  </p>
                </div>
                <Badge tone={r.direction === "VERS_CLIENT" ? "blue" : "green"}>{r.direction === "VERS_CLIENT" ? "Reçu du client" : "Envoyé"}</Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </AdminPage>
  );
}
