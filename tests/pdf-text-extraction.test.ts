import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { extractPdfLayoutText, extractPdfText } from "@/lib/schedule-parser";
import { flatText, readPdfTextItems } from "@/lib/schedule-parser/pdfjs-text";

/**
 * Extracción de texto con pdf.js (sustituye a pdf-parse 1.x). Usa un PDF
 * generado aquí, con tres columnas en la misma línea como un cuadrante.
 */
function cuadrantePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(10);
    doc.text("SESIÓN 1: Hombres -66kg", 60, 100, { lineBreak: false });
    doc.text("10:00 - 13:45", 60, 130, { lineBreak: false });
    doc.text("14:15 - 17:45", 220, 130, { lineBreak: false });
    doc.text("18:15 - 20:30", 380, 130, { lineBreak: false });
    doc.text("Ana Pérez Gómez", 60, 145, { lineBreak: false });
    doc.text("Luis Martín Ruiz", 220, 145, { lineBreak: false });
    doc.text("Eva Sanz Díaz", 380, 145, { lineBreak: false });
    doc.addPage();
    doc.text("Segunda página", 60, 100, { lineBreak: false });
    doc.end();
  });
}

describe("extracción de texto de PDF con pdf.js", () => {
  it("lee todas las páginas y respeta las líneas", async () => {
    const pdf = await cuadrantePdf();
    const { text, pages } = await extractPdfText(pdf);
    expect(pages).toBe(2);
    expect(text).toContain("SESIÓN 1: Hombres -66kg");
    expect(text).toContain("Segunda página");
    // Cada fila del PDF es una línea; las columnas de la misma fila, juntas.
    const fila = text.split("\n").find((l) => l.includes("Ana Pérez Gómez"));
    expect(fila).toMatch(/Ana Pérez Gómez\s*Luis Martín Ruiz\s*Eva Sanz Díaz/);
  });

  it("separa las columnas por defecto y las pega en el modo del calendario", async () => {
    const parsed = await readPdfTextItems(await cuadrantePdf());
    const separadas = flatText(parsed).split("\n").find((l) => l.includes("Ana"));
    const pegadas = flatText(parsed, { pegarColumnas: true }).split("\n").find((l) => l.includes("Ana"));
    expect(separadas).toBe("Ana Pérez Gómez Luis Martín Ruiz Eva Sanz Díaz");
    expect(pegadas).toBe("Ana Pérez GómezLuis Martín RuizEva Sanz Díaz");
  });

  it("la reconstrucción por geometría deja al menos dos espacios entre columnas", async () => {
    const { text, layout } = await extractPdfLayoutText(await cuadrantePdf());
    expect(layout).toBe(true);
    const fila = text.split("\n").find((l) => l.includes("Ana Pérez Gómez")) ?? "";
    const columnas = fila.trim().split(/\s{2,}/);
    expect(columnas).toEqual(["Ana Pérez Gómez", "Luis Martín Ruiz", "Eva Sanz Díaz"]);
  });

  it("rechaza lo que no es un PDF", async () => {
    await expect(extractPdfText(Buffer.from("no soy un pdf"))).rejects.toThrow("Formato PDF no válido");
  });
});
