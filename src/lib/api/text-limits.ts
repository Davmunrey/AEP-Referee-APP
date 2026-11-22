/**
 * Topes de longitud de los campos de texto que llegan en el cuerpo de las
 * peticiones.
 *
 * La mayoría de rutas validaban el tipo («es texto») pero no el tamaño, así
 * que un campo de megabytes se guardaba tal cual en la base y se pintaba en
 * todas las pantallas que lo listan. Los límites son holgados para el uso real
 * y caben en una sola tabla para que no diverjan entre rutas.
 */
export const TEXT_MAX = {
  /** Identificadores (fichas, campeonatos, huecos de la tarima). */
  id: 100,
  /** Nombres, títulos, sedes, examinadores. */
  nombre: 200,
  email: 254,
  /** Una dirección postal. */
  direccion: 300,
  /** Datos cortos de ficha: licencia, teléfono, género, antigüedad. */
  corto: 60,
  /** Motivos y comentarios de revisión. */
  motivo: 2000,
  /** Notas libres de una ficha o un examen. */
  notas: 5000,
  /** Cuerpo de un informe. */
  contenido: 20000,
  url: 2048,
  /** Elementos de una lista enviada de una vez (clubes organizadores). */
  lista: 20,
} as const;

export interface TextField {
  max: number;
  label: string;
}

/**
 * Primer campo de texto presente que supera su tope, como mensaje para el
 * usuario; `null` si todos caben. Los ausentes o de otro tipo no se juzgan
 * aquí: cada ruta ya valida si son obligatorios y su tipo.
 */
export function textTooLong(
  body: Record<string, unknown> | null | undefined,
  fields: Record<string, TextField>,
): string | null {
  if (!body) return null;
  for (const [key, { max, label }] of Object.entries(fields)) {
    const value = body[key];
    if (typeof value === "string" && value.length > max) {
      return `${label} no puede superar ${max} caracteres`;
    }
  }
  return null;
}
