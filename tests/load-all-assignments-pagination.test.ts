import { beforeEach, describe, expect, it, vi } from "vitest";

// PostgREST recorta cualquier respuesta a `max_rows` (1000 por defecto en
// Supabase) SIN error y sin ninguna señal. `loadAllAssignments` leía sin
// paginar, así que a partir de ~20-35 campeonatos perdía filas en silencio: los
// campeonatos que caían fuera del corte se repintaban como «Crítico / 0
// confirmados» aunque tuvieran la tarima llena, y su resumen de compensación
// salía vacío. Estos tests fijan el contrato de la paginación.

const PAGE = 1000;

/** Fila sintética; `slot_key` con el formato real `sesion__rol__n`. */
function fila(i: number) {
  const comp = `c${Math.floor(i / 40)}`;
  return { competition_id: comp, slot_key: `S1__ARB__${i}`, referee_id: `r${i}` };
}

let filas: ReturnType<typeof fila>[];
let rangos: [number, number][];
let errorEnPagina: number | null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const q = {
          order: () => q,
          range: async (desde: number, hasta: number) => {
            rangos.push([desde, hasta]);
            if (errorEnPagina !== null && rangos.length === errorEnPagina) {
              return { data: null, error: { message: "network" } };
            }
            return { data: filas.slice(desde, hasta + 1), error: null };
          },
        };
        return q;
      },
    }),
  }),
}));

import { loadAllAssignments } from "@/server/services/supabase-helpers";

beforeEach(() => {
  rangos = [];
  errorEnPagina = null;
});

describe("loadAllAssignments", () => {
  it("recoge todas las filas cuando hay más de una página", async () => {
    // 2500 filas: dos páginas llenas y una parcial.
    filas = Array.from({ length: 2500 }, (_, i) => fila(i));
    const mapa = await loadAllAssignments();

    const total = [...mapa.values()].reduce((n, m) => n + Object.keys(m).length, 0);
    expect(total).toBe(2500);
    expect(rangos).toEqual([
      [0, PAGE - 1],
      [PAGE, 2 * PAGE - 1],
      [2 * PAGE, 3 * PAGE - 1],
    ]);
  });

  it("para en cuanto una página vuelve incompleta, sin pedir otra de más", async () => {
    filas = Array.from({ length: 300 }, (_, i) => fila(i));
    await loadAllAssignments();
    expect(rangos).toHaveLength(1);
  });

  it("pide una página más cuando la última encaja justo en el tamaño de página", async () => {
    // Caso límite: 1000 exactas. Hay que preguntar otra vez para saber que no
    // hay más; si se asumiera que 1000 es el final, se perdería la fila 1001.
    filas = Array.from({ length: PAGE }, (_, i) => fila(i));
    const mapa = await loadAllAssignments();
    expect(rangos).toHaveLength(2);
    const total = [...mapa.values()].reduce((n, m) => n + Object.keys(m).length, 0);
    expect(total).toBe(PAGE);
  });

  it("propaga el error en vez de devolver un mapa vacío", async () => {
    // Antes el error se descartaba y un fallo de red se interpretaba como
    // «ningún juez asignado en toda la temporada».
    filas = Array.from({ length: 2500 }, (_, i) => fila(i));
    errorEnPagina = 2;
    await expect(loadAllAssignments()).rejects.toThrow(/roster_assignments/);
  });
});
