import PDFDocument from "pdfkit";
import {
  buildCompensationReceiptLayout,
  RULE_LINE,
  SIGN_LINE,
  type CompensationReceiptInput,
} from "./receipt-document";

/** Genera el PDF del recibo AEP/club, igual que la plantilla oficial. */
export function renderCompensationReceiptPdf(input: CompensationReceiptInput): Promise<Buffer> {
  const layout = buildCompensationReceiptLayout(input);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 72 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const marginLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;

    doc.font("Helvetica").fontSize(11);

    for (let i = 0; i < layout.headerLines.length; i++) {
      const line = layout.headerLines[i];
      if (layout.organizerType === "club" && i === 0) {
        doc.font("Helvetica-Bold").text(line, { align: "center", width: contentWidth });
        doc.font("Helvetica");
      } else {
        doc.text(line, { align: "center", width: contentWidth });
      }
    }

    doc.text(RULE_LINE, { align: "left", width: contentWidth, lineGap: 0 });
    doc.text(SIGN_LINE, { align: "center", width: contentWidth, lineGap: 0 });

    for (const line of layout.returnEmailLines) {
      doc.text(line, { align: "left", width: contentWidth, lineGap: 0 });
    }

    for (const line of layout.titleLines) {
      doc.text(line, { align: "center", width: contentWidth, lineGap: 0 });
    }

    doc.text(layout.bodyParagraph, { align: "left", width: contentWidth, lineGap: 0 });
    for (const line of layout.bodyClosingLines) {
      doc.text(line, { align: "left", width: contentWidth, lineGap: 0 });
    }

    doc.end();
  });
}
