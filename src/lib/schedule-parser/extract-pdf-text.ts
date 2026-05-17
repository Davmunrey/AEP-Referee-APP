/** Tamaño máximo aceptado para PDFs de horario (5 MB). */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** MIME types aceptados. */
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
]);

export interface PdfExtractionResult {
  text: string;
  pages: number;
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
  const mod = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default: (b: Buffer) => Promise<{ text: string; numpages: number }>;
  };
  const result = await mod.default(buf);
  return { text: result.text, pages: result.numpages };
}

/** Valida MIME y devuelve un mensaje legible si no es aceptable. */
export function validatePdfMime(mime: string | undefined): string | null {
  if (!mime) return null;
  return ACCEPTED_MIME.has(mime) ? null : `Tipo de archivo no soportado: ${mime}`;
}
