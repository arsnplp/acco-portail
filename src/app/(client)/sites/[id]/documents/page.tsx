import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { DocumentList } from "@/components/documents/list";

export const metadata = { title: "Documents du site" };

export default async function SiteDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const documents = await prisma.document.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <h2 className="mb-4 text-lg">Documents de ce site</h2>
      <DocumentList documents={documents} emptyText="Aucun document lié à ce site pour le moment." />
    </div>
  );
}
