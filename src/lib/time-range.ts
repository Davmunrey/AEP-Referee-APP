/**
 * Rangos horarios de la plantilla ("10:00 - 13:00"), tal como se guardan en
 * `RosterSession.horarioCompeticion` / `horarioPesaje`.
 *
 * El formato es texto libre heredado del Excel, así que el par
 * parsear/serializar tiene que ser reversible: un horario suelto ("13:00") se
 * lee siempre como hora de inicio, de modo que la hora de fin necesita el guion
 * inicial para no colarse en el otro campo al vaciar el inicio.
 */

/** "10:00 - 13:00" → ["10:00","13:00"], normalizando a HH:MM para <input type=time>. */
export function parseTimeRange(value: string): [string, string] {
  const norm = (t?: string) => {
    const m = (t ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
    return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
  };
  const parts = value.split(/[–-]/).map((s) => s.trim());
  return [norm(parts[0]), norm(parts[1])];
}

/** Inversa de `parseTimeRange`: conserva en qué extremo está cada hora. */
export function formatTimeRange(start: string, end: string): string {
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return `- ${end}`;
  return "";
}
