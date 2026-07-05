import PDFDocument from "pdfkit";
import {
  buildCompensationReceiptLayout,
  type CompensationReceiptInput,
} from "./receipt-document";
import { AEP_LOGO_PNG_BASE64 } from "./receipt-logo";

const AEP_LOGO = Buffer.from(AEP_LOGO_PNG_BASE64, "base64");

/**
 * Genera el PDF del recibo AEP/club reproduciendo la plantilla oficial:
 * logo + cabecera a dos columnas, título destacado, cuerpo justificado y el
 * bloque «a devolver al e-mail…» fijado al pie de la página.
 */
export function renderCompensationReceiptPdf(input: CompensationReceiptInput): Promise<Buffer> {
  const layout = buildCompensationReceiptLayout(input);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;
    const isAep = layout.organizerType === "aep";

    // ── Cabecera: logo (solo AEP) a la izquierda, datos de la organización a la
    //    derecha (alineados a la derecha, como el recibo oficial).
    const headerTop = doc.y;
    let textX = left;
    let textW = contentWidth;
    const headerAlign: "right" | "center" = isAep ? "right" : "center";

    if (isAep) {
      const logoW = 155;
      try {
        doc.image(AEP_LOGO, left, headerTop, { width: logoW });
      } catch {
        /* si el logo fallara, seguimos sin él */
      }
      textX = left + logoW + 16;
      textW = right - textX;
    }

    doc.y = headerTop;
    layout.headerLines.forEach((line, i) => {
      if (i === 0) {
        doc.font("Helvetica-Bold").fontSize(isAep ? 11 : 12);
      } else {
        doc.font("Helvetica-Oblique").fontSize(8.5);
      }
      doc.text(line, isAep ? textX : left, doc.y, {
        width: isAep ? textW : contentWidth,
        align: headerAlign,
      });
    });

    // Baja por debajo del más alto entre el logo y el texto de cabecera.
    doc.x = left;
    doc.y = Math.max(doc.y, headerTop + (isAep ? 64 : 0)) + 8;
    doc.strokeColor("#333333").lineWidth(1).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(1.4);

    // ── Título destacado.
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(19);
    layout.titleLines.forEach((line) =>
      doc.text(line, left, doc.y, { width: contentWidth, align: "center", lineGap: 2 }),
    );
    doc.moveDown(1.6);

    // ── Cuerpo justificado.
    doc.font("Helvetica").fontSize(11.5);
    doc.text(layout.bodyParagraph, left, doc.y, { width: contentWidth, align: "justify", lineGap: 3 });
    doc.moveDown(0.5);

    for (const line of layout.bodyClosingLines) {
      const bold = line.startsWith("IBAN:");
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(11.5);
      doc.text(line, left, doc.y, { width: contentWidth, align: "left", lineGap: 3 });
      if (line.startsWith("IBAN:")) doc.moveDown(1);
      else if (line.startsWith("Y para que conste")) doc.moveDown(1);
      else if (line.startsWith("Fecha:")) doc.moveDown(3); // espacio para la firma
    }

    // ── Pie fijado al fondo de la página.
    const footerLines = layout.returnEmailLines;
    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    const footerBlockHeight = footerLines.length * 14 + 16;
    const footerY = doc.page.height - doc.page.margins.bottom - footerBlockHeight;
    doc.strokeColor("#333333").lineWidth(1).moveTo(left, footerY).lineTo(right, footerY).stroke();
    doc.y = footerY + 8;
    for (const line of footerLines) {
      doc.text(line, left, doc.y, { width: contentWidth, align: "center" });
    }

    doc.end();
  });
}
