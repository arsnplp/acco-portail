import { FileText, Download } from "lucide-react";
import type { Document } from "@prisma/client";
import { signedUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { fmtDate } from "@/lib/format";

export const DOC_KIND = { CONTRAT: { label: "Contrat", tone: "blue" }, FACTURE: { label: "Facture", tone: "yellow" }, DEVIS: { label: "Devis", tone: "green" }, AUTRE: { label: "Document", tone: "neutral" } } as const;

export async function DocumentList({ documents, emptyText = "Vos contrats, factures et devis apparaîtront ici." }: { documents: (Document & { site?: { name: string } | null })[]; emptyText?: string }) {
  if (documents.length === 0) return <Empty icon={FileText} title="Aucun document" text={emptyText} />;
  const withUrls = await Promise.all(documents.map(async (d) => ({ ...d, url: await signedUrl("documents", d.storagePath, 900) })));
  return (
    <div className="grid gap-2">
      {withUrls.map((d) => (
        <Card key={d.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={DOC_KIND[d.kind].tone}>{DOC_KIND[d.kind].label}</Badge>
              <p className="truncate font-medium text-title">{d.title}</p>
            </div>
            <p className="mt-1 text-xs text-text">{fmtDate(d.createdAt)}{d.site?.name ? ` · ${d.site.name}` : ""}</p>
          </div>
          <a href={d.url ?? "#"} target="_blank" rel="noreferrer" aria-label="Télécharger" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-title hover:bg-surface-2">
            <Download size={16} />
          </a>
        </Card>
      ))}
    </div>
  );
}
