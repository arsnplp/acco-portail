import type { Document, DocumentKind, DocumentRequest } from "@prisma/client";

export const DOC_KIND: Record<DocumentKind, { label: string; plural: string; tone: "blue" | "yellow" | "green" | "neutral" }> = {
  CONTRAT: { label: "Contrat", plural: "Contrats", tone: "blue" },
  FACTURE: { label: "Facture", plural: "Factures", tone: "yellow" },
  DEVIS: { label: "Devis", plural: "Devis", tone: "green" },
  AUTRE: { label: "Document", plural: "Autres documents", tone: "neutral" },
};

export const DOC_SECTIONS: DocumentKind[] = ["CONTRAT", "FACTURE", "DEVIS", "AUTRE"];

export function groupByKind<T extends Pick<Document, "kind">>(docs: T[]) {
  return DOC_SECTIONS.map((kind) => ({ kind, docs: docs.filter((d) => d.kind === kind) }));
}

export function requestLabel(r: Pick<DocumentRequest, "kind" | "message">) {
  return r.message?.trim() ? `${DOC_KIND[r.kind].label} · ${r.message.trim()}` : DOC_KIND[r.kind].label;
}
