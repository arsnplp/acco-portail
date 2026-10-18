import Link from "next/link";
import { ChevronLeft, Upload } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { DocumentSections } from "@/components/documents/list";
import { AutoUploadInput } from "@/components/ui/auto-upload";
import { timeAgo } from "@/lib/format";
import { uploadRequestedDocument } from "./actions";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { client } = await requireClientContext();
  const [documents, toProvide] = await Promise.all([
    prisma.document.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, include: { site: { select: { name: true } } } }),
    prisma.documentRequest.findMany({ where: { clientId: client.id, direction: "VERS_CLIENT", status: "EN_ATTENTE" }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <Page title="Documents" subtitle="Vos contrats, factures et devis, déposés par l’équipe Acco.">
      <Link href="/compte" className="-mt-4 mb-4 inline-flex items-center gap-1 text-sm text-text hover:text-title"><ChevronLeft size={16} /> Mon compte</Link>

      {toProvide.length > 0 && (
        <>
          <SectionTitle emoji="📤">L’équipe Acco vous demande</SectionTitle>
          <div className="grid gap-2">
            {toProvide.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 border-yellow/50 py-3">
                <div className="min-w-0"><p className="truncate font-medium text-title">{r.message}</p><p className="text-xs text-text">Demandé {timeAgo(r.createdAt)}</p></div>
                <form action={uploadRequestedDocument.bind(null, r.id)}>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-card bg-title px-3 text-sm font-semibold text-bg">
                    <Upload size={14} /> Envoyer
                    <AutoUploadInput accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                  </label>
                </form>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle emoji="📄">Mes documents</SectionTitle>
      <DocumentSections documents={documents} emptyText="Vos contrats, factures et devis apparaîtront ici dès que l’équipe les dépose." />
      <p className="mt-6 text-center text-xs text-muted">Il vous manque un document ? Demandez-le dans Messages.</p>
    </Page>
  );
}
