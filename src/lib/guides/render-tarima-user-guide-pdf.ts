import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import {
  TARIMA_GUIDE_META,
  buildTarimaUserGuideSections,
  tarimaGuideAppUrl,
  type GuideSection,
} from "./tarima-user-guide-content";

const GUIDE_SCREENSHOTS: { afterSection: number; file: string; caption: string }[] = [
  { afterSection: 2, file: "01-dashboard.png", caption: "Fig. 1 — Panel de inicio" },
  { afterSection: 3, file: "02-campeonatos.png", caption: "Fig. 2 — Campeonatos" },
  { afterSection: 4, file: "04-tarima-montada.png", caption: "Fig. 3 — Tarima (asignación)" },
  { afterSection: 5, file: "09-cuadrante-export.png", caption: "Fig. 4 — Exportar cuadrante" },
  { afterSection: 6, file: "10-compensacion.png", caption: "Fig. 5 — Compensación (Sx + Google Maps)" },
  { afterSection: 7, file: "05-directorio.png", caption: "Fig. 6 — Directorio y domicilio" },
];

function screenshotPath(file: string): string | null {
  const path = join(process.cwd(), "docs/images", file);
  return existsSync(path) ? path : null;
}

function drawScreenshotPage(doc: InstanceType<typeof PDFDocument>, file: string, caption: string) {
  const path = screenshotPath(file);
  if (!path) return;

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(11).text(caption, { align: "center" });
  doc.moveDown(0.4);
  const y = doc.y;
  doc.image(path, 56, y, {
    fit: [doc.page.width - 112, 380],
    align: "center",
  });
}

function drawSection(doc: InstanceType<typeof PDFDocument>, section: GuideSection, sectionNum: number) {
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(13).text(`${sectionNum}. ${section.title}`, { underline: true });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10);

  if (section.intro) {
    doc.text(section.intro, { align: "justify" });
    doc.moveDown(0.4);
  }

  for (const step of section.steps) {
    doc.font("Helvetica-Bold").fontSize(10.5).text(`${step.id} — ${step.title}`);
    doc.font("Helvetica").fontSize(10).moveDown(0.15);
    for (const line of step.body) {
      doc.text(`· ${line}`, { align: "justify", indent: 12 });
      doc.moveDown(0.12);
    }
    if (step.substeps) {
      for (const sub of step.substeps) {
        doc.moveDown(0.15);
        doc.font("Helvetica-Bold").text(`${sub.title}`);
        doc.font("Helvetica").moveDown(0.1);
        for (const line of sub.body) {
          doc.text(`  – ${line}`, { align: "justify", indent: 18 });
          doc.moveDown(0.1);
        }
      }
    }
    doc.moveDown(0.35);
  }
}

/** Genera el manual de usuario AEP Tarima en PDF (estilo guías AEP). */
export function renderTarimaUserGuidePdf(appUrl = tarimaGuideAppUrl()): Promise<Buffer> {
  const sections = buildTarimaUserGuideSections(appUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(16).text(TARIMA_GUIDE_META.association, { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(18).text(TARIMA_GUIDE_META.title, { align: "center" });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).text(TARIMA_GUIDE_META.subtitle, { align: "center" });
    doc.moveDown(0.6);
    doc.fontSize(9).fillColor("#444444").text(`Actualizado: ${TARIMA_GUIDE_META.updatedAt}`, { align: "center" });
    doc.fillColor("#000000");
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(10).text(
      "Este documento describe el funcionamiento completo de AEP Tarima: censo de jueces, tarimas, aprobaciones, compensación de gastos (Google Maps, desglose por sesión Sx), estadísticas y app móvil.",
      { align: "justify" },
    );
    doc.moveDown(0.5);
    doc.text(`URL de acceso: ${appUrl}/sign-in`, { align: "center" });

    sections.forEach((section, index) => {
      const sectionNum = index + 1;
      drawSection(doc, section, sectionNum);
      const shot = GUIDE_SCREENSHOTS.find((s) => s.afterSection === sectionNum);
      if (shot) drawScreenshotPage(doc, shot.file, shot.caption);
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#666666");
      doc.text(
        `AEP Tarima — ${TARIMA_GUIDE_META.updatedAt} — Página ${i + 1} de ${range.count}`,
        56,
        doc.page.height - 40,
        { align: "center", width: doc.page.width - 112 },
      );
      doc.fillColor("#000000");
    }

    doc.end();
  });
}

export function tarimaUserGuideFilename(): string {
  return "Manual-AEP-Tarima-Gestion-Jueces.pdf";
}
