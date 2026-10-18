import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { DOC_KIND } from "@/components/documents/list";
import { fmtDate } from "@/lib/format";
import { UploadDocumentForm } from "./upload-form";
import { deleteDocument } from "./actions";

export const metadata = { title: "Documents" };

export default async function DocumentsAdminPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: preClient } = await searchParams;
  const [clients, documents] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, include: { sites: { select: { id: true, name: true } } } }),
    prisma.document.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { client: { select: { name: true } }, site: { select: { name: true } } } }),
  ]);
  return (
    <AdminPage title="Documents">
      <SectionTitle emoji="⬆️">Déposer un document</SectionTitle>
      <UploadDocumentForm clients={clients.map((c) => ({ id: c.id, name: c.name, sites: c.sites }))} defaultClientId={preClient} />

      <SectionTitle emoji="📄">Derniers documents</SectionTitle>
      <div className="grid gap-2">
        {documents.map((d) => (
          <Card key={d.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><Badge tone={DOC_KIND[d.kind].tone}>{DOC_KIND[d.kind].label}</Badge><p className="truncate font-medium text-title">{d.title}</p></div>
              <p className="mt-1 text-xs text-text">{d.client.name}{d.site ? ` · ${d.site.name}` : ""} · {fmtDate(d.createdAt)}</p>
            </div>
            <form action={deleteDocument.bind(null, d.id)}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Supprimer</SubmitButton></form>
          </Card>
        ))}
        {documents.length === 0 && <p className="text-sm text-text">Aucun document.</p>}
      </div>
    </AdminPage>
  );
}
