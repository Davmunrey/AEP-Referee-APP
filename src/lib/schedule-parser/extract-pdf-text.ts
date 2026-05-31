import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { hasPdfSignature } from "@/lib/import-security";

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
 * Extrae el texto de un PDF en servidor. Importa `pdf-parse/lib/pdf-parse.js`
 * dinámicamente para evitar el modo debug de la raíz del paquete.
 */
export async function extractPdfText(
  buffer: Buffer | Uint8Array,
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
  const mod = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default: (b: Buffer) => Promise<{ text: string; numpages: number }>;
  };
  const result = await mod.default(buf);
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

export interface PdfLayoutResult extends PdfExtractionResult {
  /** true si el texto procede de `pdftotext -layout` (rejilla por columnas). */
  layout: boolean;
}

/**
 * Extrae texto PREFIRIENDO `pdftotext -layout`, que conserva la geometría de
 * columnas — imprescindible para cuadrantes (rejilla roles×sesiones). Cae a
 * pdf-parse plano si pdftotext no está disponible (p. ej. en serverless).
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
    // continúa al fallback plano
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  // Fallback: pdf-parse plano (sin geometría) + OCR si hace falta.
  const flat = await extractPdfText(buf);
  return { ...flat, layout: false };
}

/** Valida MIME y devuelve un mensaje legible si no es aceptable. */
export function validatePdfMime(mime: string | undefined): string | null {
  if (!mime) return null;
  return ACCEPTED_MIME.has(mime) ? null : `Tipo de archivo no soportado: ${mime}`;
}
