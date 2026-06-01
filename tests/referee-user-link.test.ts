import { describe, expect, it } from "vitest";
import { mapApproval, mapReferee, refereeToDbRow } from "@/server/db/mappers";

/**
 * Enlace juez↔usuario y remitente/revisor de propuestas (migraciones 021/022).
 * Los nuevos campos son opcionales y retrocompatibles: si la columna no está
 * presente en la fila, el campo del dominio queda undefined.
 */

const baseRefereeRow = {
  id: "j001",
  nombre: "Ana Juez",
  zona: "CENTRO",
  nivel: "Nacional",
  estado: "Activo",
  eventos: 3,
  ultimo: "—",
  disp: true,
  iniciales: "AJ",
};

describe("mapReferee — userId", () => {
  it("mapea user_id cuando existe", () => {
    expect(mapReferee({ ...baseRefereeRow, user_id: "u-123" }).userId).toBe("u-123");
  });
  it("undefined cuando la columna falta o es null", () => {
    expect(mapReferee(baseRefereeRow).userId).toBeUndefined();
    expect(mapReferee({ ...baseRefereeRow, user_id: null }).userId).toBeUndefined();
  });
});

describe("refereeToDbRow — user_id", () => {
  it("incluye user_id solo cuando userId está definido", () => {
    expect(refereeToDbRow({ nombre: "X" })).not.toHaveProperty("user_id");
    expect(refereeToDbRow({ userId: "u-9" }).user_id).toBe("u-9");
  });
  it("traduce userId null a user_id null (desenlazar)", () => {
    expect(refereeToDbRow({ userId: undefined as unknown as string })).not.toHaveProperty("user_id");
    expect(refereeToDbRow({ userId: null as unknown as string }).user_id).toBeNull();
  });
});

describe("mapApproval — submittedById / reviewedById", () => {
  const baseApprovalRow = {
    id: "apr-1",
    competition_id: "c1",
    competition_name: "Open Centro",
    zona: "CENTRO",
    submitted_by: "Ana Juez",
    submitted_at: "2026-06-01T10:00:00Z",
    status: "pendiente",
    assignments: {},
  };

  it("mapea los UUID cuando existen", () => {
    const p = mapApproval({
      ...baseApprovalRow,
      submitted_by_id: "u-sub",
      reviewed_by: "Comité",
      reviewed_by_id: "u-rev",
    });
    expect(p.submittedById).toBe("u-sub");
    expect(p.reviewedById).toBe("u-rev");
  });

  it("undefined cuando faltan las columnas (retrocompatibilidad)", () => {
    const p = mapApproval(baseApprovalRow);
    expect(p.submittedById).toBeUndefined();
    expect(p.reviewedById).toBeUndefined();
    expect(p.submittedBy).toBe("Ana Juez");
  });
});
