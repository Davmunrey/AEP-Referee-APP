import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { hasPdfSignature } from "@/lib/import-security";
import {
  flatText,
  readPdfTextItems,
  type FlatTextOptions,
  type PdfPages,
  type PdfTextItem,
} from "./pdfjs-text";

const execFileAsync = promisify(execFile);

/** Tamaño máximo aceptado para PDFs de horario (5 MB). */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** MIME types aceptados — solo PDF estricto. */
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/x-pdf",
]);

export interface PdfExtractionResult {
  text: string;
  pages: number;
}

function usableText(text: string): boolean {
  return text.replace(/\s+/g, "").length >= 40;
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function extractWithPdftotext(pdfPath: string): Promise<string> {
  if (!(await commandExists("pdftotext"))) return "";
  const outPath = `${pdfPath}.txt`;
  try {
    await execFileAsync("pdftotext", ["-layout", pdfPath, outPath], { timeout: 15000 });
    return await readFile(outPath, "utf8");
  } catch {
    return "";
  }
}

async function extractWithMacVisionOcr(pdfPath: string, workDir: string): Promise<string> {
  if (!(await commandExists("pdftoppm")) || !(await commandExists("swift"))) return "";
  const dir = join(workDir, "ocr-pages");
  await mkdir(dir, { recursive: true });
  const prefix = join(dir, "page");
  try {
    await execFileAsync("pdftoppm", ["-png", "-r", "200", pdfPath, prefix], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const files = (await readdir(dir))
      .filter((f) => f.endsWith(".png"))
      .sort()
      .map((f) => join(dir, f));
    if (files.length === 0) return "";
    const script = resolve(process.cwd(), "scripts/vision-ocr.swift");
    const { stdout } = await execFileAsync("swift", [script, ...files], {
      timeout: 90000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return "";
  }
}

/**
 * Extrae el texto de un PDF en servidor con pdf.js; si no sale texto útil
 * (PDF escaneado), prueba `pdftotext` y después OCR cuando están disponibles.
 */
export async function extractPdfText(
  buffer: Buffer | Uint8Array,
  options: FlatTextOptions = {},
): Promise<PdfExtractionResult> {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `El PDF excede el tamaño máximo (${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB)`,
    );
  }
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!hasPdfSignature(buf)) {
    throw new Error("Formato PDF no válido");
  }
  const parsed = await readPdfTextItems(buf);
  const result = { text: flatText(parsed, options), numpages: parsed.pages.length };
  if (usableText(result.text)) return { text: result.text, pages: result.numpages };

  const dir = await mkdtemp(join(tmpdir(), "aep-pdf-"));
  try {
    const pdfPath = join(dir, "input.pdf");
    await writeFile(pdfPath, buf);
    const pdftotext = await extractWithPdftotext(pdfPath);
    if (usableText(pdftotext)) return { text: pdftotext, pages: result.numpages };
    const ocr = await extractWithMacVisionOcr(pdfPath, dir);
    if (usableText(ocr)) return { text: ocr, pages: result.numpages };
    return { text: result.text || pdftotext || ocr, pages: result.numpages };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Puntos PDF por columna de carácter (≈ ancho medio de carácter). */
const CHAR_W = 4.6;
/** Tolerancia vertical para agrupar ítems en la misma fila. */
const ROW_TOL = 3;
/** Hueco horizontal (en puntos) a partir del cual dos fragmentos no van pegados. */
const GAP_PT = 1;

/**
 * Reconstruye texto con geometría de columnas a partir de las posiciones x/y de
 * pdf.js. Equivale a `pdftotext -layout` pero en JS puro: funciona en
 * serverless (Vercel) sin binarios.
 */
function renderPageWithLayout(pageItems: PdfTextItem[]): string {
  const items = pageItems.filter((it) => it.str && it.str.trim().length > 0);
  if (items.length === 0) return "";

  // Agrupa ítems en filas por coordenada y (de arriba a abajo).
  const rows: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const it of items) {
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) <= ROW_TOL);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y); // y mayor = más arriba

  // reduce, no spread: con decenas de miles de ítems de texto el spread
  // puede reventar la pila de llamadas (RangeError).
  const minX = items.reduce(
    (min, it) => (it.transform[4] < min ? it.transform[4] : min),
    Number.POSITIVE_INFINITY,
  );

  const lines = rows.map((row) => {
    row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    let line = "";
    let prevEnd: number | undefined;
    for (const it of row.items) {
      const x = it.transform[4];
      const col = Math.max(0, Math.round((x - minX) / CHAR_W));
      if (col > line.length) line += " ".repeat(col - line.length);
      else if (prevEnd !== undefined && x - prevEnd > GAP_PT && !/\s$/.test(line)) {
        // pdf.js moderno quita los espacios de los bordes de cada fragmento.
        // Se reponen según el hueco: uno entre palabras y dos o más entre
        // columnas, que es lo que separa una columna de la siguiente.
        const gap = x - prevEnd;
        line += " ".repeat(gap >= CHAR_W ? Math.max(2, Math.round(gap / CHAR_W)) : 1);
      }
      line += it.str;
      prevEnd = it.width === undefined ? undefined : x + it.width;
    }
    return line.replace(/\s+$/, "");
  });
  return lines.join("\n");
}

/** Texto con geometría reconstruida para todo el documento (mismo formato que antes). */
export function layoutText({ pages }: PdfPages): string {
  return pages.map((items) => `\n\n${renderPageWithLayout(items)}`).join("");
}

/** Extrae texto con geometría reconstruida desde pdf.js (sirve en Vercel). */
async function extractWithPdfjsLayout(buf: Buffer): Promise<string> {
  try {
    return layoutText(await readPdfTextItems(buf));
  } catch {
    return "";
  }
}

export interface PdfLayoutResult extends PdfExtractionResult {
  /** true si el texto procede de `pdftotext -layout` (rejilla por columnas). */
  layout: boolean;
}

/**
 * Extrae texto PREFIRIENDO `pdftotext -layout`, que conserva la geometría de
 * columnas — imprescindible para cuadrantes (rejilla roles×sesiones). Cae a
 * pdf.js plano si pdftotext no está disponible (p. ej. en serverless).
 */
export async function extractPdfLayoutText(
  buffer: Buffer | Uint8Array,
): Promise<PdfLayoutResult> {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `El PDF excede el tamaño máximo (${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB)`,
    );
  }
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!hasPdfSignature(buf)) throw new Error("Formato PDF no válido");

  // 1) pdftotext -layout (mejor calidad cuando está disponible: local/CI).
  const dir = await mkdtemp(join(tmpdir(), "aep-pdf-"));
  try {
    const pdfPath = join(dir, "input.pdf");
    await writeFile(pdfPath, buf);
    const layoutText = await extractWithPdftotext(pdfPath);
    if (usableText(layoutText)) {
      const pages = (layoutText.match(/\f/g)?.length ?? 0) + 1;
      return { text: layoutText, pages, layout: true };
    }
  } catch {
    // continúa al siguiente método
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  // 2) Reconstrucción geométrica con pdf.js (JS puro — funciona en Vercel).
  const jsLayout = await extractWithPdfjsLayout(buf);
  if (usableText(jsLayout)) {
    const pages = (jsLayout.match(/\f/g)?.length ?? 0) + 1;
    return { text: jsLayout, pages, layout: true };
  }

  // 3) Fallback: texto plano de pdf.js (sin geometría) + OCR si hace falta.
  const flat = await extractPdfText(buf);
  return { ...flat, layout: false };
}

/** Valida MIME y devuelve un mensaje legible si no es aceptable. */
export function validatePdfMime(mime: string | undefined): string | null {
  if (!mime) return null;
  return ACCEPTED_MIME.has(mime) ? null : `Tipo de archivo no soportado: ${mime}`;
}
