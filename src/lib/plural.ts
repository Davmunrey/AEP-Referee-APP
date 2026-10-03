/**
 * Número y sustantivo concordados: «1 propuesta», «3 propuestas».
 *
 * Una treintena de textos interpolaban el número con el sustantivo siempre en
 * plural, y la portada decía «Tienes 1 aprobaciones pendientes». Un solo sitio
 * para esto en vez de un ternario distinto en cada pantalla.
 */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${palabra(n, singular, plural)}`;
}

/** Solo la palabra, para cuando el número va en otro elemento. */
export function palabra(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
