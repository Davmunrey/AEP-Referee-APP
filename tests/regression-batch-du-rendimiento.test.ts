import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/async-pool";

// El recálculo de compensación guardaba las liquidaciones en serie (un
// centenar de viajes a la base para una tarima de 27 jueces). Ahora en
// paralelo con tope; estos tests fijan el contrato del ayudante.
describe("mapWithConcurrency", () => {
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("conserva el orden de entrada aunque terminen desordenadas", async () => {
    const out = await mapWithConcurrency([30, 5, 20, 1], 4, async (ms, i) => {
      await espera(ms);
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3]);
  });

  it("nunca hay más de `limit` tareas a la vez", async () => {
    let vivas = 0;
    let pico = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      vivas += 1;
      pico = Math.max(pico, vivas);
      await espera(2);
      vivas -= 1;
    });
    expect(pico).toBe(3);
  });

  it("propaga el primer error y deja de lanzar tareas", async () => {
    let lanzadas = 0;
    await expect(
      mapWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 2, async (i) => {
        lanzadas += 1;
        await espera(1);
        if (i === 3) throw new Error("falla la 3");
      }),
    ).rejects.toThrow("falla la 3");
    expect(lanzadas).toBeLessThan(50);
  });

  it("con la lista vacía no hace nada", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});

import { pickActiveRosterHref } from "@/lib/nav-utils";
import { addDaysIso, todayIso } from "@/lib/business-date";

// «Tarima activa», el atajo de la barra lateral.
describe("pickActiveRosterHref", () => {
  const hoy = todayIso();

  it("un campeonato de varios días que ya ha empezado cuenta como vigente", () => {
    // Antes solo contaba lo que empezaba hoy o después, así que el campeonato
    // que se está arbitrando ahora mismo no era candidato.
    const href = pickActiveRosterHref([
      { id: "en-curso", fecha: addDaysIso(hoy, -1), fechaFin: addDaysIso(hoy, 1), estado: "Incompleto" },
      { id: "dentro-de-un-mes", fecha: addDaysIso(hoy, 30), fechaFin: addDaysIso(hoy, 30), estado: "Incompleto" },
    ]);
    expect(href).toBe("/competitions/en-curso");
  });

  it("si los próximos están completos, no salta a un campeonato de hace años", () => {
    // Antes caía en el incompleto MÁS ANTIGUO del calendario.
    const href = pickActiveRosterHref([
      { id: "historico-2024", fecha: "2024-03-10", fechaFin: "2024-03-10", estado: "Incompleto" },
      { id: "proximo", fecha: addDaysIso(hoy, 10), fechaFin: addDaysIso(hoy, 10), estado: "Completo" },
    ]);
    expect(href).toBe("/competitions/proximo");
  });

  it("sin nada vigente, el último celebrado", () => {
    const href = pickActiveRosterHref([
      { id: "viejo", fecha: "2024-01-01", fechaFin: "2024-01-01", estado: "Incompleto" },
      { id: "reciente", fecha: addDaysIso(hoy, -5), fechaFin: addDaysIso(hoy, -5), estado: "Completo" },
    ]);
    expect(href).toBe("/competitions/reciente");
  });
});
