import Link from "next/link";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { DocumentSections } from "@/components/documents/list";

export const metadata = { title: "Documents du site" };

export default async function SiteDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const documents = await prisma.document.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg">Documents de ce site</h2><Link href="/compte/documents" className="text-sm text-text hover:text-title">Tous mes documents →</Link></div>
      <DocumentSections documents={documents} emptyText="Aucun document lié à ce site pour le moment." />
    </div>
  );
}
