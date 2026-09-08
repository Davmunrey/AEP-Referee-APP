/**
 * Choques entre campeonatos: un juez asignado a dos tarimas de las mismas
 * fechas.
 *
 * Las reglas de tarima (`roster-rules`) solo miran DENTRO de un campeonato, así
 * que nada impedía sentar al mismo juez en dos campeonatos del mismo fin de
 * semana; el choque no aparecía en ninguna pantalla y se descubría el día de la
 * competición. Aquí se detecta para avisar, no para bloquear: la decisión final
 * es de quien monta la tarima.
 */

export interface RefereeBusyElsewhere {
  competitionId: string;
  competitionName: string;
  fecha: string;
  fechaFin: string;
}

/** refereeId → campeonatos solapados en los que ya está asignado. */
export type RefereeBusyMap = Record<string, RefereeBusyElsewhere[]>;

export interface CompetitionDates {
  fecha: string;
  fechaFin: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Rango [inicio, fin] normalizado, o `null` si las fechas no son utilizables. */
export function competitionDateRange(
  competition: Partial<CompetitionDates> | null | undefined,
): { start: string; end: string } | null {
  const fecha = typeof competition?.fecha === "string" ? competition.fecha.slice(0, 10) : "";
  if (!ISO_DAY.test(fecha)) return null;
  const fin = typeof competition?.fechaFin === "string" ? competition.fechaFin.slice(0, 10) : "";
  // Una `fechaFin` ausente o anterior al inicio (dato degradado) se trata como
  // un campeonato de un solo día en vez de como un rango imposible.
  const end = ISO_DAY.test(fin) && fin >= fecha ? fin : fecha;
  return { start: fecha, end };
}

/**
 * ¿Comparten día dos campeonatos? Sin fechas utilizables no se afirma el
 * choque: un aviso falso en la tarima es peor que no avisar.
 */
export function competitionDatesOverlap(
  a: Partial<CompetitionDates> | null | undefined,
  b: Partial<CompetitionDates> | null | undefined,
): boolean {
  const rangeA = competitionDateRange(a);
  const rangeB = competitionDateRange(b);
  if (!rangeA || !rangeB) return false;
  return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
}

export interface BusyMapInput {
  /** Campeonato que se está montando (se excluye de sus propios choques). */
  competition: { id: string } & Partial<CompetitionDates>;
  /** Resto de campeonatos con jueces asignados. */
  others: Array<{ id: string; nombre: string } & Partial<CompetitionDates>>;
  /** Asignaciones vivas: a qué campeonato está asignado cada juez. */
  assignments: Array<{ competitionId: string; refereeId: string }>;
}

export function buildRefereeBusyMap(input: BusyMapInput): RefereeBusyMap {
  const overlapping = new Map<string, RefereeBusyElsewhere>();
  for (const other of input.others) {
    if (other.id === input.competition.id) continue;
    if (!competitionDatesOverlap(input.competition, other)) continue;
    const range = competitionDateRange(other);
    overlapping.set(other.id, {
      competitionId: other.id,
      competitionName: other.nombre,
      fecha: range?.start ?? "",
      fechaFin: range?.end ?? "",
    });
  }
  if (overlapping.size === 0) return {};

  const map: RefereeBusyMap = {};
  const seen = new Set<string>();
  for (const row of input.assignments) {
    if (!row.refereeId) continue;
    const competition = overlapping.get(row.competitionId);
    if (!competition) continue;
    // Un juez ocupa varios huecos del mismo campeonato: el aviso es por
    // campeonato, no por hueco.
    const dedupeKey = `${row.refereeId}::${row.competitionId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    (map[row.refereeId] ??= []).push(competition);
  }
  for (const entries of Object.values(map)) {
    entries.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.competitionName.localeCompare(b.competitionName, "es"));
  }
  return map;
}

/** Texto corto para la ficha del juez. */
export function busyElsewhereLabel(entries: RefereeBusyElsewhere[] | undefined): string | null {
  if (!entries || entries.length === 0) return null;
  if (entries.length === 1) return `Ya asignado en ${entries[0]!.competitionName}`;
  return `Ya asignado en ${entries.length} campeonatos de estas fechas`;
}
