/**
 * Avisos de entrada de calendario, compartidos por los dos lectores.
 *
 * El lector de CSV avisaba de la zona no deducida y de la fecha pendiente; el
 * de PDF, de ninguna de las dos. Y el PDF es el camino habitual: es lo que
 * publica la AEP.
 *
 * Sin zona, `normalizeZoneInput` guarda `null`, y un campeonato con `zona`
 * nula no lo ve NINGÚN delegado de zona: el listado filtra por código de zona
 * y `null` no casa con ninguno. Queda visible solo para super admin, delegado
 * de jueces y financiero. Es decir, el campeonato existe y la persona que
 * tiene que montarle la tarima no sabe que existe.
 *
 * Los dos mensajes viven aquí para que no vuelvan a divergir.
 */

export function zonaNoDeducidaWarning(nombre: string, localidad: string): string {
  return `Zona no deducida: ${nombre} (${localidad || "sede pendiente"}). Se creará sin zona y no lo verá ningún delegado de zona; asígnasela a mano después de importar.`;
}

/**
 * `rango` es la fecha que el lector se ha inventado para poder importar la
 * fila. Un rango de mes a mes —«oct-nov» en el calendario— se resuelve al día
 * 1 del primero y al último del segundo, y eso NO es la fecha del campeonato:
 * es un hueco de dos meses. Se dice, porque un campeonato de 61 días solapa
 * con todos los de esos dos meses y el mapa de choques marcaría a casi
 * cualquier juez como «ya asignado» contra él.
 */
export function fechaPendienteWarning(
  nombre: string,
  rawDate: string,
  rango?: { inicio: string; fin: string },
): string {
  const base = `Fecha pendiente/no exacta: ${nombre} (${rawDate})`;
  if (!rango) return base;
  return `${base}. Se importará del ${rango.inicio} al ${rango.fin}; corrígela cuando la AEP confirme el día.`;
}
