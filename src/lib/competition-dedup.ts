import { isRosterLockedByApproval, isRosterPendingApproval } from "@/lib/roster-coverage";
import type { Competition } from "@/lib/types";

/** Normaliza nombre para comparar duplicados (acentos, espacios, mayúsculas). */
export function normalizeCompetitionName(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // Pliega puntuación (paréntesis, comas, guiones…) a espacio para que
    // "Cto de España (Junior)" y "Cto de España Junior" compartan clave.
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Clave estable: mismo campeonato lógico aunque el id en BD difiera. */
export function competitionDedupKey(c: {
  nombre: string;
  fecha: string;
  tipo?: string;
}): string {
  return `${normalizeCompetitionName(c.nombre)}__${c.fecha}__${c.tipo ?? ""}`;
}

export interface CompetitionDuplicateGroup {
  key: string;
  competitions: Competition[];
}

export function groupCompetitionDuplicates(
  competitions: Competition[],
): CompetitionDuplicateGroup[] {
  const map = new Map<string, Competition[]>();
  for (const c of competitions) {
    const key = competitionDedupKey(c);
    const list = map.get(key) ?? [];
    list.push(c);
    map.set(key, list);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, competitions]) => ({
      key,
      competitions: [...competitions].sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

/**
 * Peso del estado de aprobación al decidir qué copia sobrevive.
 *
 * Una tarima aprobada es la versión que alguien firmó, y una propuesta enviada
 * está esperando esa firma. Las dos pesan por encima de cualquier recuento.
 */
function pesoAprobacion(c: Competition): number {
  if (isRosterLockedByApproval(c.aprobacion)) return 2;
  if (isRosterPendingApproval(c.aprobacion)) return 1;
  return 0;
}

/** Conserva la copia aprobada; si ninguna lo está, la que más tarima tiene. */
export function pickCompetitionToKeep(group: Competition[]): Competition {
  return [...group].sort((a, b) => {
    // Antes esto empezaba por `confirmados`, así que la limpieza de duplicados
    // podía borrar justamente la copia APROBADA para quedarse con un borrador
    // que tenía un juez más. Y esa limpieza se dispara sola al aplicar la
    // importación del calendario, antes de que nadie vea qué se va a borrar.
    const aprobacion = pesoAprobacion(b) - pesoAprobacion(a);
    if (aprobacion !== 0) return aprobacion;
    if (b.confirmados !== a.confirmados) return b.confirmados - a.confirmados;
    if (a.estado === "Completo" && b.estado !== "Completo") return -1;
    if (b.estado === "Completo" && a.estado !== "Completo") return 1;
    return a.id.localeCompare(b.id);
  })[0]!;
}

export function competitionsToRemoveInGroup(group: Competition[]): Competition[] {
  const keep = pickCompetitionToKeep(group);
  return group.filter((c) => c.id !== keep.id);
}
