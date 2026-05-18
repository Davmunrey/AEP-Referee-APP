import type { Competition } from "@/lib/types";

/** Normaliza nombre para comparar duplicados (acentos, espacios, mayúsculas). */
export function normalizeCompetitionName(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
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

/** Conserva el que más datos de tarima tiene; empate → id menor. */
export function pickCompetitionToKeep(group: Competition[]): Competition {
  return [...group].sort((a, b) => {
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
