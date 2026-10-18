import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentSections } from "@/components/documents/list";
import { RequestDocumentForm } from "./request-form";
import { requestLabel } from "@/lib/documents";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { client } = await requireClientContext();
  const [documents, requests, sites] = await Promise.all([
    prisma.document.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, include: { site: { select: { name: true } } } }),
    prisma.documentRequest.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.site.findMany({ where: { clientId: client.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const pending = requests.filter((r) => r.status === "EN_ATTENTE");
  const done = requests.filter((r) => r.status === "TERMINEE").slice(0, 5);

  return (
    <Page title="Documents" subtitle="Contrats, factures et devis.">
      <Link href="/compte" className="-mt-4 mb-4 inline-flex items-center gap-1 text-sm text-text hover:text-title"><ChevronLeft size={16} /> Mon compte</Link>

      <RequestDocumentForm sites={sites} />

      {pending.length > 0 && (
        <>
          <SectionTitle emoji="⏳">Demandes en attente</SectionTitle>
          <div className="grid gap-2">
            {pending.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-title">{requestLabel(r)}</p><p className="text-xs text-text">Demandé {timeAgo(r.createdAt)}</p></div>
                <Badge tone="yellow">En attente</Badge>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle emoji="📄">Mes documents</SectionTitle>
      <DocumentSections documents={documents} />

      {done.length > 0 && (
        <>
          <SectionTitle emoji="✅">Demandes traitées</SectionTitle>
          <div className="grid gap-2">
            {done.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 py-3">
                <p className="truncate text-sm text-text-strong">{requestLabel(r)}</p>
                <Badge tone="green">Reçu</Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
