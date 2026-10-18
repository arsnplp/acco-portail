import { FileText, Download } from "lucide-react";
import type { Document } from "@prisma/client";
import { signedUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Dot } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { DOC_KIND, groupByKind } from "@/lib/documents";

export { DOC_KIND } from "@/lib/documents";

type Doc = Document & { site?: { name: string } | null };

export async function DocumentRow({ d, action }: { d: Doc; action?: React.ReactNode }) {
  const url = await signedUrl("documents", d.storagePath, 900);
  return (
    <Card className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-title">{d.title}</p>
        <p className="mt-0.5 text-xs text-text">{fmtDate(d.createdAt)}{d.site?.name ? ` · ${d.site.name}` : ""}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {action}
        <a href={url ?? "#"} target="_blank" rel="noreferrer" aria-label="Télécharger" className="flex size-10 items-center justify-center rounded-full border border-border text-title hover:bg-surface-2">
          <Download size={16} />
        </a>
      </div>
    </Card>
  );
}

/** Documents groupés par type : Contrats, Factures, Devis, Autres. */
export function DocumentSections({ documents, emptyText = "Vos contrats, factures et devis apparaîtront ici.", renderAction }: { documents: Doc[]; emptyText?: string; renderAction?: (d: Doc) => React.ReactNode }) {
  if (documents.length === 0) return <Empty icon={FileText} title="Aucun document" text={emptyText} />;
  return (
    <div className="space-y-6">
      {groupByKind(documents).filter((g) => g.docs.length > 0).map((g) => (
        <section key={g.kind}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-title">
            <Dot tone={DOC_KIND[g.kind].tone} />
            {DOC_KIND[g.kind].plural} <span className="font-normal text-text">({g.docs.length})</span>
          </h3>
          <div className="grid gap-2">{g.docs.map((d) => <DocumentRow key={d.id} d={d} action={renderAction?.(d)} />)}</div>
        </section>
      ))}
    </div>
  );
}
