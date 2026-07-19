import { describe, expect, it } from "vitest";
import { mapCompetition } from "@/server/db/mappers";

const BASE_ROW = {
  id: "evt-001",
  nombre: "Campeonato de prueba",
  tipo: "AEP-2",
  fecha: "2026-05-01",
  fecha_fin: "2026-05-02",
  sede: "Madrid",
  sesiones: 3,
  requeridos: 9,
  confirmados: 0,
  estado: "Borrador",
  aprobacion: "Sin propuesta",
};

describe("mapCompetition con columnas nulas (filas legacy)", () => {
  it("fecha_fin nula cae a la fecha de inicio, no al literal \"null\"", () => {
    const comp = mapCompetition({ ...BASE_ROW, fecha_fin: null });
    expect(comp.fechaFin).toBe("2026-05-01");
    expect(comp.fechaFin).not.toBe("null");
  });

  it("aprobacion nula cae a \"Sin propuesta\"", () => {
    const comp = mapCompetition({ ...BASE_ROW, aprobacion: null });
    expect(comp.aprobacion).toBe("Sin propuesta");
  });

  it("una fila completa se mapea sin alterar valores", () => {
    const comp = mapCompetition(BASE_ROW);
    expect(comp.fechaFin).toBe("2026-05-02");
    expect(comp.aprobacion).toBe("Sin propuesta");
    expect(comp.id).toBe("evt-001");
  });
});
