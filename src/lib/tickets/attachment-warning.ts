/**
 * Aviso cuando un ticket o un comentario se guardan pero alguno de sus
 * adjuntos no.
 *
 * El fallo se resolvía con un `console.warn` en el servidor: el ticket salía
 * como creado, la captura no estaba, y quien la había adjuntado no tenía forma
 * de saberlo hasta que alguien le pedía la prueba que creía haber enviado.
 */
export function attachmentWarningMessage(nombres: string[] | undefined): string | null {
  if (!nombres || nombres.length === 0) return null;
  const lista = nombres.join(", ");
  return nombres.length === 1
    ? `Se guardó, pero el adjunto «${lista}» no se pudo subir. Vuelve a adjuntarlo en un comentario.`
    : `Se guardó, pero ${nombres.length} adjuntos no se pudieron subir (${lista}). Vuelve a adjuntarlos en un comentario.`;
}
