import PDFDocument from "pdfkit";
import { buildCompensationReceiptLines, formatReceiptAmountEur } from "./receipt-document";
import type { CompensationReceiptInput } from "./receipt-document";

/** Genera el PDF del recibo. El IBAN solo viaja en memoria durante la petición. */
export function renderCompensationReceiptPdf(input: CompensationReceiptInput): Promise<Buffer> {
  const lines = buildCompensationReceiptLines(input);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 72 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica").fontSize(11);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isRule = line.startsWith("_");
      if (isRule) {
        doc.moveDown(0.4);
        doc.fontSize(10).text(line, { align: "center" });
        doc.fontSize(11);
        doc.moveDown(0.4);
        continue;
      }

      if (i < 2 && input.organizer.type === "club") {
        doc.font("Helvetica-Bold").text(line, { align: "center" });
        doc.font("Helvetica");
        continue;
      }

      if (input.organizer.type === "aep" && i < 7) {
        doc.text(line, { align: "center" });
        continue;
      }

      doc.text(line, { align: "left" });
      doc.moveDown(0.35);
    }

    if (input.breakdownLines && input.breakdownLines.length > 0) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).text("Desglose de compensación");
      doc.font("Helvetica").fontSize(10).moveDown(0.25);
      for (const line of input.breakdownLines) {
        const detail = line.detail ? ` (${line.detail})` : "";
        doc.text(`· ${line.label}${detail}: ${formatReceiptAmountEur(line.amount)}`);
      }
      doc.moveDown(0.35);
      doc.font("Helvetica-Bold").text(`Total: ${formatReceiptAmountEur(input.amountEur)}`);
      doc.font("Helvetica");
    }

    doc.end();
  });
}
