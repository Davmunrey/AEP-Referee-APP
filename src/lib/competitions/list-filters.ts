import type { Competition } from "@/lib/types";

/**
 * Códigos de zona que ofrece el filtro de la tabla de campeonatos.
 *
 * La zona del delegado entra siempre, aunque todavía no tenga ningún
 * campeonato: el filtro arranca preseleccionado con ella, y si no figuraba
 * entre las opciones el `select` se quedaba con un `value` inexistente. El
 * navegador pintaba entonces «Todas las zonas» mientras la tabla filtraba en
 * realidad por la zona del delegado, así que la lista salía vacía sin
 * explicación.
 */
export function zoneFilterOptions(
  competitions: Pick<Competition, "zona">[],
  userZona?: string | null,
): string[] {
  const codes = new Set<string>();
  for (const c of competitions) {
    if (c.zona) codes.add(c.zona);
  }
  if (userZona) codes.add(userZona);
  return [...codes].sort();
}
