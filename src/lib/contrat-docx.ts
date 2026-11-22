/** Version Word du contrat : page 1 = image de couverture, puis parties, articles et signatures (même contenu que le PDF). */
import { AlignmentType, Document, Footer, ImageRun, Packer, PageBreak, PageNumber, Paragraph, TextRun } from "docx";
import { contenuContrat, couvertureBytes, type ContratComplet } from "@/lib/contrats";

const CM = 567; // 1 cm en twips
const P = (texte: string, o: { bold?: boolean; size?: number; color?: string; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 120, line: 300 }, children: [new TextRun({ text: texte, bold: o.bold, size: o.size ?? 20, color: o.color, font: "Arial" })] });

export async function construireDocx(c: ContratComplet) {
  const d = await contenuContrat(c);
  const couv = await couvertureBytes();
  const corps: Paragraph[] = [];
  corps.push(P("CONTRAT DE PRESTATION DE SERVICES DIGITAUX", { bold: true, size: 30, after: 60 }));
  corps.push(P(d.sousTitre, { bold: true, size: 17, color: "6B6E78", after: 280 }));
  corps.push(P(d.prestataire, { after: 160 }));
  corps.push(P("ET :", { bold: true, after: 160 }));
  corps.push(P(d.client, { after: 200 }));
  corps.push(P("Il a été convenu ce qui suit.", { after: 160 }));
  if (d.site) corps.push(P(`Site concerné : ${d.site}.`));
  for (const [t, texte] of d.articles) {
    if (t) corps.push(new Paragraph({ spacing: { before: 240, after: 100 }, children: [new TextRun({ text: t, bold: true, size: 24, font: "Arial" })] }));
    for (const ligne of texte.split("\n")) corps.push(P(ligne, { after: 80 }));
  }
  corps.push(new Paragraph({ spacing: { before: 360, after: 100 }, children: [new TextRun({ text: "Signatures", bold: true, size: 24, font: "Arial" })] }));
  corps.push(P(`Fait en deux exemplaires, le ${d.dateDuJour}.`, { after: 400 }));
  corps.push(new Paragraph({ tabStops: [{ type: "left", position: 9 * CM }], spacing: { after: 60 }, children: [new TextRun({ text: `Pour ${d.agence.nom}`, bold: true, font: "Arial", size: 20 }), new TextRun({ text: "\tPour le Client", bold: true, font: "Arial", size: 20 })] }));
  corps.push(new Paragraph({ tabStops: [{ type: "left", position: 9 * CM }], spacing: { after: 900 }, children: [new TextRun({ text: d.signataireAcco, font: "Arial", size: 18, color: "6B6E78" }), new TextRun({ text: `\t${d.signataireClient}`, font: "Arial", size: 18, color: "6B6E78" })] }));
  corps.push(new Paragraph({ tabStops: [{ type: "left", position: 9 * CM }], children: [new TextRun({ text: "Signature précédée de « Lu et approuvé »", font: "Arial", size: 16, color: "6B6E78" }), new TextRun({ text: "\tSignature précédée de « Lu et approuvé »", font: "Arial", size: 16, color: "6B6E78" })] }));

  const pied = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${c.reference} · ${d.agence.nom} · page `, font: "Arial", size: 16, color: "6B6E78" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "6B6E78" })] })] });
  const sections = [];
  if (couv) {
    // Page de garde : image A4 pleine page, marges nulles.
    sections.push({ properties: { page: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, size: { width: 11906, height: 16838 } } }, children: [new Paragraph({ children: [new ImageRun({ type: "png", data: couv, transformation: { width: 794, height: 1123 } }), new PageBreak()] })] });
  }
  sections.push({ properties: { page: { margin: { top: 2 * CM, right: 2 * CM, bottom: 2 * CM, left: 2 * CM }, size: { width: 11906, height: 16838 } } }, footers: { default: pied }, children: corps });
  const doc = new Document({ creator: d.agence.nom, title: `Contrat ${c.reference}`, sections });
  return Packer.toBuffer(doc);
}
