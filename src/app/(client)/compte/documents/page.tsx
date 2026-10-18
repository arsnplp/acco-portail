import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { DocumentList } from "@/components/documents/list";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { client } = await requireClientContext();
  const documents = await prisma.document.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, include: { site: { select: { name: true } } } });
  return (
    <Page title="Documents" subtitle="Contrats, factures et devis.">
      <Link href="/compte" className="-mt-4 mb-4 inline-flex items-center gap-1 text-sm text-text hover:text-title"><ChevronLeft size={16} /> Mon compte</Link>
      <DocumentList documents={documents} />
    </Page>
  );
}
