import { describe, expect, it } from "vitest";
import { getStore } from "@/server/store";
import { buildKpis } from "@/server/services/memory-helpers";
import { addDaysIso, todayIso } from "@/lib/business-date";
import type { Competition } from "@/lib/types";

// El panel es operativo: solo cuenta campeonatos no celebrados. El gemelo de
// Supabase ya los filtraba para los indicadores; el de memoria no, y la
// portada local decía «Próximas competiciones: 2 · 30 plazas sin cubrir» al
// lado de una salud que, filtrando bien, decía «0/0 plazas».
describe("indicadores del panel en memoria", () => {
  it("no cuentan campeonatos ya celebrados", () => {
    const store = getStore();
    const base = { tipo: "AEP-3" as const, sede: "X", sesiones: 1, requeridos: 1, confirmados: 0, estado: "Borrador" as Competition["estado"], aprobacion: "Sin propuesta", zona: "CENTRO" };
    store.competitions.push(
      { ...base, id: "kpi-pasado", nombre: "Pasado", fecha: addDaysIso(todayIso(), -60), fechaFin: addDaysIso(todayIso(), -59) },
      { ...base, id: "kpi-futuro", nombre: "Futuro", fecha: addDaysIso(todayIso(), 30), fechaFin: addDaysIso(todayIso(), 30) },
    );
    const proximas = buildKpis().find((k) => k.label === "Próximas competiciones")!;
    const ids = store.competitions.filter((c) => c.id.startsWith("kpi-")).length;
    expect(ids).toBe(2);
    // El futuro cuenta; el pasado no.
    const sinPasado = store.competitions.filter((c) => c.fechaFin >= todayIso()).length;
    expect(Number(proximas.value)).toBe(sinPasado);
  });
});
