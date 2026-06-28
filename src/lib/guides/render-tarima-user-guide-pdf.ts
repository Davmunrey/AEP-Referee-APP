import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import {
  TARIMA_GUIDE_META,
  buildTarimaUserGuideSections,
  tarimaGuideAppUrl,
  type GuideSection,
  type GuideStep,
} from "./tarima-user-guide-content";
import { PDF_FONTS, PDF_THEME } from "./tarima-user-guide-pdf-theme";

export interface GuideScreenshot {
  afterSection: number;
  file: string;
  caption: string;
}

export const GUIDE_SCREENSHOTS: GuideScreenshot[] = [
  { afterSection: 1, file: "00-sign-in.png", caption: "Fig. 1 — Acceso a la plataforma" },
  { afterSection: 2, file: "01-dashboard.png", caption: "Fig. 2 — Panel de inicio" },
  { afterSection: 3, file: "02-campeonatos.png", caption: "Fig. 3 — Listado de campeonatos" },
  { afterSection: 4, file: "04-tarima-montada.png", caption: "Fig. 4 — Tarima con jueces asignados" },
  { afterSection: 5, file: "09-cuadrante-export.png", caption: "Fig. 5 — Menú exportar cuadrante" },
  { afterSection: 6, file: "11-compensacion-hub.png", caption: "Fig. 6 — Panel central de compensación" },
  { afterSection: 6, file: "10-compensacion.png", caption: "Fig. 7 — Compensación por campeonato" },
  { afterSection: 7, file: "05-directorio.png", caption: "Fig. 8 — Directorio de jueces" },
  { afterSection: 10, file: "12-sidebar.png", caption: "Fig. 9 — Navegación lateral" },
];

type PdfDoc = InstanceType<typeof PDFDocument>;

function assetPath(...parts: string[]): string | null {
  const path = join(process.cwd(), ...parts);
  return existsSync(path) ? path : null;
}

function screenshotPath(file: string): string | null {
  return assetPath("docs", "images", file);
}

function pageContentBottom(doc: PdfDoc): number {
  return doc.page.height - 64;
}

function ensureSpace(doc: PdfDoc, needed: number): void {
  if (doc.y + needed > pageContentBottom(doc)) {
    doc.addPage();
    drawRunningHeader(doc);
  }
}

function drawRunningHeader(doc: PdfDoc): void {
  const y = PDF_THEME.margin - 10;
  doc.save();
  doc.rect(0, 0, doc.page.width, 5).fill(PDF_THEME.red);
  doc.fillColor(PDF_THEME.muted).font(PDF_FONTS.regular).fontSize(8);
  doc.text("AEP Tarima · Gestión de Jueces", PDF_THEME.margin, y, {
    width: PDF_THEME.contentWidth,
    align: "left",
  });
  doc.text(TARIMA_GUIDE_META.updatedAt, PDF_THEME.margin, y, {
    width: PDF_THEME.contentWidth,
    align: "right",
  });
  doc.restore();
  doc.fillColor(PDF_THEME.text);
  doc.y = PDF_THEME.margin + 16;
}

function drawCover(doc: PdfDoc, appUrl: string): void {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(PDF_THEME.surface);
  doc.rect(0, 0, doc.page.width, 10).fill(PDF_THEME.red);

  const logo = assetPath("public", "assets", "aep-master-logo.png");
  if (logo) {
    doc.image(logo, (doc.page.width - 280) / 2, 96, { width: 280 });
  }

  doc.fillColor(PDF_THEME.muted).font(PDF_FONTS.regular).fontSize(10);
  doc.text(TARIMA_GUIDE_META.association, 0, logo ? 210 : 120, {
    align: "center",
    width: doc.page.width,
  });

  doc.fillColor(PDF_THEME.text).font(PDF_FONTS.bold).fontSize(28);
  doc.text(TARIMA_GUIDE_META.title, PDF_THEME.margin, logo ? 250 : 160, {
    align: "center",
    width: doc.page.width - PDF_THEME.margin * 2,
  });

  doc.moveDown(0.4);
  doc.fillColor(PDF_THEME.textSecondary).font(PDF_FONTS.regular).fontSize(13);
  doc.text(TARIMA_GUIDE_META.subtitle, { align: "center" });

  doc.moveDown(1.2);
  const boxY = doc.y;
  doc.roundedRect(PDF_THEME.margin + 40, boxY, PDF_THEME.contentWidth - 80, 88, 10).fill(PDF_THEME.white);
  doc.fillColor(PDF_THEME.text).font(PDF_FONTS.regular).fontSize(10.5);
  doc.text(
    "Manual operativo de la plataforma web AEP Tarima: censo de jueces, tarimas, aprobaciones, compensación de gastos, estadísticas y exportación de cuadrantes.",
    PDF_THEME.margin + 56,
    boxY + 14,
    { width: PDF_THEME.contentWidth - 112, align: "justify", lineGap: 2 },
  );

  doc.fillColor(PDF_THEME.muted).fontSize(9);
  doc.text(`Actualizado: ${TARIMA_GUIDE_META.updatedAt}`, PDF_THEME.margin, doc.page.height - 120, {
    align: "center",
    width: PDF_THEME.contentWidth,
  });
  doc.fillColor(PDF_THEME.red).font(PDF_FONTS.bold).fontSize(10);
  doc.text(`${appUrl}/sign-in`, { align: "center" });
  doc.fillColor(PDF_THEME.text);
}

function drawTableOfContents(
  doc: PdfDoc,
  sections: GuideSection[],
  sectionStartPages: number[],
): void {
  drawRunningHeader(doc);
  doc.fillColor(PDF_THEME.red).font(PDF_FONTS.bold).fontSize(16);
  doc.text("Índice", PDF_THEME.margin, doc.y);
  doc.moveDown(0.8);

  sections.forEach((section, index) => {
    const y = doc.y;
    doc.fillColor(PDF_THEME.text).font(PDF_FONTS.bold).fontSize(11);
    doc.text(`${index + 1}. ${section.title}`, PDF_THEME.margin, y);
    doc.fillColor(PDF_THEME.muted).font(PDF_FONTS.regular).fontSize(10);
    const label = String(sectionStartPages[index] ?? "—");
    doc.text(label, PDF_THEME.margin, y, { width: PDF_THEME.contentWidth, align: "right" });
    doc.moveDown(0.55);
  });
}

function drawCallout(doc: PdfDoc, text: string): void {
  ensureSpace(doc, 48);
  const x = PDF_THEME.margin;
  const y = doc.y;
  const h = 40;
  doc.save();
  doc.roundedRect(x, y, PDF_THEME.contentWidth, h, 6).fill(PDF_THEME.redLight);
  doc.rect(x, y, 4, h).fill(PDF_THEME.red);
  doc.fillColor(PDF_THEME.textSecondary).font(PDF_FONTS.oblique).fontSize(9.5);
  doc.text(text, x + 14, y + 10, { width: PDF_THEME.contentWidth - 24, lineGap: 1 });
  doc.restore();
  doc.fillColor(PDF_THEME.text);
  doc.y = y + h + 10;
}

function drawStep(doc: PdfDoc, step: GuideStep): void {
  ensureSpace(doc, 56);
  const y = doc.y;
  doc.save();
  doc.circle(PDF_THEME.margin + 8, y + 8, 8).fill(PDF_THEME.red);
  doc.fillColor(PDF_THEME.white).font(PDF_FONTS.bold).fontSize(8);
  doc.text(step.id, PDF_THEME.margin + 4, y + 4, { width: 16, align: "center" });
  doc.restore();

  doc.fillColor(PDF_THEME.text).font(PDF_FONTS.bold).fontSize(11);
  doc.text(step.title, PDF_THEME.margin + 22, y - 1, { width: PDF_THEME.contentWidth - 22 });
  doc.moveDown(0.35);

  doc.fillColor(PDF_THEME.textSecondary).font(PDF_FONTS.regular).fontSize(10);
  for (const line of step.body) {
    ensureSpace(doc, 20);
    doc.text(`• ${line}`, PDF_THEME.margin + 22, doc.y, {
      width: PDF_THEME.contentWidth - 22,
      align: "justify",
      lineGap: 1,
    });
    doc.moveDown(0.2);
  }

  if (step.substeps) {
    for (const sub of step.substeps) {
      ensureSpace(doc, 40);
      doc.fillColor(PDF_THEME.text).font(PDF_FONTS.bold).fontSize(10);
      doc.text(sub.title, PDF_THEME.margin + 22);
      doc.moveDown(0.15);
      doc.fillColor(PDF_THEME.textSecondary).font(PDF_FONTS.regular).fontSize(9.5);
      for (const line of sub.body) {
        ensureSpace(doc, 18);
        doc.text(`– ${line}`, PDF_THEME.margin + 30, doc.y, {
          width: PDF_THEME.contentWidth - 30,
          lineGap: 1,
        });
        doc.moveDown(0.12);
      }
    }
  }
  doc.moveDown(0.45);
}

function drawSection(doc: PdfDoc, section: GuideSection, sectionNum: number): void {
  doc.addPage();
  drawRunningHeader(doc);

  const bandY = doc.y;
  doc.save();
  doc.rect(PDF_THEME.margin, bandY, PDF_THEME.contentWidth, 34).fill(PDF_THEME.red);
  doc.fillColor(PDF_THEME.white).font(PDF_FONTS.bold).fontSize(13);
  doc.text(`${sectionNum}. ${section.title}`, PDF_THEME.margin + 12, bandY + 10, {
    width: PDF_THEME.contentWidth - 24,
  });
  doc.restore();
  doc.y = bandY + 44;

  if (section.intro) {
    doc.fillColor(PDF_THEME.textSecondary).font(PDF_FONTS.regular).fontSize(10);
    doc.text(section.intro, PDF_THEME.margin, doc.y, {
      width: PDF_THEME.contentWidth,
      align: "justify",
      lineGap: 2,
    });
    doc.moveDown(0.6);
  }

  if (section.title.includes("COMPENSACIÓN")) {
    drawCallout(
      doc,
      "«Mont.» = montar el sistema informático (Liftingcast / OpenLifter / Goodlift), no la plaza ordenador en tarima. «Comparte» solo exime kilometraje; el alojamiento sigue según los km.",
    );
  }

  doc.fillColor(PDF_THEME.text);
  for (const step of section.steps) {
    drawStep(doc, step);
  }
}

function drawScreenshotPage(doc: PdfDoc, file: string, caption: string): void {
  const path = screenshotPath(file);
  if (!path) return;

  doc.addPage();
  drawRunningHeader(doc);
  doc.fillColor(PDF_THEME.text).font(PDF_FONTS.bold).fontSize(11);
  doc.text(caption, PDF_THEME.margin, doc.y, { width: PDF_THEME.contentWidth, align: "center" });
  doc.moveDown(0.5);

  const frameY = doc.y;
  const frameH = 360;
  doc.save();
  doc.roundedRect(PDF_THEME.margin, frameY, PDF_THEME.contentWidth, frameH, 8).fill(PDF_THEME.white);
  doc.lineWidth(1).roundedRect(PDF_THEME.margin, frameY, PDF_THEME.contentWidth, frameH, 8).stroke(PDF_THEME.border);
  doc.image(path, PDF_THEME.margin + 8, frameY + 8, {
    fit: [PDF_THEME.contentWidth - 16, frameH - 16],
    align: "center",
    valign: "center",
  });
  doc.restore();
}

function drawFooters(doc: PdfDoc): void {
  const range = doc.bufferedPageRange();
  const mark = assetPath("public", "assets", "aep-mark.png");
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (i === 0) continue;

    const footerY = doc.page.height - 42;
    doc.save();
    doc.moveTo(PDF_THEME.margin, footerY - 6).lineTo(doc.page.width - PDF_THEME.margin, footerY - 6).strokeColor(PDF_THEME.border).stroke();
    if (mark) {
      doc.image(mark, PDF_THEME.margin, footerY, { width: 14 });
    }
    doc.fillColor(PDF_THEME.muted).font(PDF_FONTS.regular).fontSize(8);
    doc.text("AEP Tarima — Asociación Española de Powerlifting", PDF_THEME.margin + (mark ? 20 : 0), footerY + 2);
    doc.text(`Página ${i + 1} de ${range.count}`, PDF_THEME.margin, footerY + 2, {
      width: PDF_THEME.contentWidth,
      align: "right",
    });
    doc.restore();
    doc.fillColor(PDF_THEME.text);
  }
}

/** Genera el manual de usuario AEP Tarima en PDF con branding oficial. */
export function renderTarimaUserGuidePdf(appUrl = tarimaGuideAppUrl()): Promise<Buffer> {
  const sections = buildTarimaUserGuideSections(appUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PDF_THEME.margin, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const sectionStartPages: number[] = [];

    drawCover(doc, appUrl);

    doc.addPage(); // reserva índice (página 2)
    const tocPageIndex = doc.bufferedPageRange().count - 1;

    sections.forEach((section, index) => {
      sectionStartPages.push(doc.bufferedPageRange().count + 1);
      drawSection(doc, section, index + 1);
      for (const shot of GUIDE_SCREENSHOTS.filter((s) => s.afterSection === index + 1)) {
        drawScreenshotPage(doc, shot.file, shot.caption);
      }
    });

    doc.switchToPage(tocPageIndex);
    doc.y = PDF_THEME.margin;
    drawTableOfContents(doc, sections, sectionStartPages);

    drawFooters(doc);
    doc.end();
  });
}
