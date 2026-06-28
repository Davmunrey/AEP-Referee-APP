import PDFDocument from "pdfkit";
import {
  buildCompensationReceiptLayout,
  type CompensationReceiptInput,
} from "./receipt-document";

const SIGN_LINE =
  "__________________________________________________";

/** Genera el PDF del recibo AEP/club. El IBAN solo viaja en memoria durante la petición. */
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
      if (layout.organizerType === "club" && i < 2) {
        doc.font("Helvetica-Bold").text(line, { align: "center", width: contentWidth });
        doc.font("Helvetica");
      } else {
        doc.text(line, { align: "center", width: contentWidth });
      }
    }

    doc.moveDown(0.45);
    const ruleY = doc.y;
    doc
      .moveTo(marginLeft, ruleY)
      .lineTo(marginLeft + contentWidth, ruleY)
      .lineWidth(0.75)
      .strokeColor("#000000")
      .stroke();
    doc.moveDown(0.55);

    doc.text(SIGN_LINE, { align: "center", width: contentWidth });
    doc.moveDown(0.55);

    for (const line of layout.returnEmailLines) {
      doc.text(line, { align: "left", width: contentWidth, lineGap: 1 });
    }

    doc.moveDown(0.45);
    for (const line of layout.titleLines) {
      doc.text(line, { align: "center", width: contentWidth, lineGap: 1 });
    }

    doc.moveDown(0.55);
    for (const line of layout.bodyLines) {
      doc.text(line, { align: "left", width: contentWidth, lineGap: 3 });
      doc.moveDown(0.15);
    }

    doc.end();
  });
}
