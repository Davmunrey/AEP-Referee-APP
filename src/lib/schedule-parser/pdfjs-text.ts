/**
 * Lectura de texto de PDF con pdf.js (`pdfjs-dist`), solo en servidor.
 *
 * Sustituye a `pdf-parse` 1.x, que llevaba dentro pdf.js 1.10 (de 2018). La
 * versión 2 de `pdf-parse` ya no deja recorrer los textos con su posición, y
 * esa posición es la que reconstruye las columnas de los cuadrantes; por eso se
 * usa directamente su motor.
 *
 * `flatText` reproduce el texto «plano» de `pdf-parse` 1.x (mismo criterio de
 * saltos de línea y de separación entre páginas) porque los analizadores de
 * horarios y calendarios están afinados sobre ese formato.
 */

/** Un fragmento de texto con su matriz de posición `[a, b, c, d, x, y]`. */
export interface PdfTextItem {
  str: string;
  transform: number[];
  /** Ancho en puntos PDF (sin él no se sabe dónde acaba el fragmento). */
  width?: number;
  hasEOL?: boolean;
}

export interface PdfPages {
  /** Fragmentos de texto de cada página, en el orden de pdf.js. */
  pages: PdfTextItem[][];
}

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | undefined;

/**
 * Carga pdf.js una vez. El «worker» se registra en `globalThis.pdfjsWorker`
 * importándolo de forma estática: así pdf.js no intenta abrir un hilo aparte
 * (no hay en serverless) y el empaquetador ve el fichero y lo incluye.
 */
function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= (async () => {
    // @ts-expect-error pdfjs-dist no publica tipos para el worker.
    const worker: unknown = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return pdfjsPromise;
}

/** Lee todos los fragmentos de texto de un PDF, página a página. */
export async function readPdfTextItems(data: Uint8Array): Promise<PdfPages> {
  const pdfjs = await loadPdfjs();
  // pdf.js se queda con el buffer (lo transfiere): se le pasa una copia.
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const pages: PdfTextItem[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const it of content.items) {
        if ("str" in it) items.push({ str: it.str, transform: it.transform, width: it.width, hasEOL: it.hasEOL });
      }
      pages.push(items);
      page.cleanup();
    }
    return { pages };
  } finally {
    await task.destroy();
  }
}

export interface FlatTextOptions {
  /**
   * Pega las columnas de una misma línea, como hacía pdf.js 1.x («Black
   * CrownAEP3OPEN»). pdf.js moderno marca el hueco entre columnas con un
   * fragmento de solo espacios; el importador del calendario reconoce
   * justamente el formato pegado, así que ahí se descartan. El de horarios lee
   * mejor con el hueco y es el comportamiento por defecto.
   */
  pegarColumnas?: boolean;
}

/**
 * Texto de una página con el criterio de `pdf-parse` 1.x: los fragmentos de la
 * misma línea (misma `y`) van seguidos y cada cambio de `y` abre línea nueva.
 * Los fragmentos vacíos (marca de fin de línea de pdf.js moderno) se ignoran.
 */
function flatPageText(items: PdfTextItem[], { pegarColumnas = false }: FlatTextOptions): string {
  let text = "";
  let lastY: number | undefined;
  for (const item of items) {
    if (item.str === "" || (pegarColumnas && item.str.trim() === "")) continue;
    const y = item.transform[5];
    if (lastY === undefined || lastY === y) text += item.str;
    else text += `\n${item.str}`;
    lastY = y;
  }
  return text;
}

/** Texto plano del documento, igual que `pdf-parse` 1.x (páginas con `\n\n`). */
export function flatText({ pages }: PdfPages, options: FlatTextOptions = {}): string {
  return pages.map((items) => `\n\n${flatPageText(items, options)}`).join("");
}
