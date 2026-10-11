"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AssignmentsMap, Competition, FlagsMap, Referee, RosterSession } from "@/lib/types";

/**
 * Lo que necesita la vista previa del cuadrante (paso «Revisión»), tal y como
 * lo ha leído la página de la tarima en el servidor.
 *
 * La vista previa pedía el HTML a `/roster/quadrant` al montarse: una función
 * aparte con su sesión, su comprobación de zona y 3-4 lecturas encadenadas, para
 * releer el campeonato, la plantilla, las asignaciones y los nombres que esta
 * misma página acababa de leer y mandar al navegador. Con estos datos el panel
 * genera el mismo HTML (`generateQuadrantHtml` es puro) sin salir del cliente.
 *
 * Son las props del servidor. La plantilla, las asignaciones y los avisos los
 * sustituye el panel por el estado de RosterBuilder (`live`), que ya trae la
 * respuesta de cada guardado antes de que llegue el `router.refresh()`.
 * Imprimir y «Abrir» siguen yendo a la ruta.
 */
export interface RosterQuadrantSource {
  competition: Competition;
  template: RosterSession[];
  assignments: AssignmentsMap;
  flags: FlagsMap;
  refLookup: (id: string) => { nombre: string; nivel: string } | undefined;
}

const RosterQuadrantSourceContext = createContext<RosterQuadrantSource | null>(null);

interface RosterQuadrantSourceProviderProps {
  competition: Competition;
  template: RosterSession[];
  assignments: AssignmentsMap;
  flags: FlagsMap;
  referees: Pick<Referee, "id" | "nombre" | "nivel">[];
  children: ReactNode;
}

export function RosterQuadrantSourceProvider({
  competition,
  template,
  assignments,
  flags,
  referees,
  children,
}: RosterQuadrantSourceProviderProps) {
  const value = useMemo<RosterQuadrantSource>(() => {
    const byId = new Map(referees.map((r) => [r.id, r]));
    return {
      competition,
      template,
      assignments,
      flags,
      // Mismo mapeo que la ruta del cuadrante.
      refLookup: (id) => {
        const r = byId.get(id);
        return r ? { nombre: String(r.nombre), nivel: String(r.nivel) } : undefined;
      },
    };
  }, [competition, template, assignments, flags, referees]);
  return (
    <RosterQuadrantSourceContext.Provider value={value}>{children}</RosterQuadrantSourceContext.Provider>
  );
}

/** `null` fuera de la página de la tarima: el panel vuelve a pedir el HTML a la ruta. */
export function useRosterQuadrantSource(): RosterQuadrantSource | null {
  return useContext(RosterQuadrantSourceContext);
}
