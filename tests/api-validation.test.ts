import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  ISO_DATE_RE,
  isEventType,
  isRefereeLevel,
  isRefereeStatus,
  validateCompetitionFields,
} from "@/app/api/_lib/validation";

describe("guards de enums", () => {
  it("acepta los valores de las whitelists", () => {
    expect(isEventType("AEP-1")).toBe(true);
    expect(isEventType("AEP-3")).toBe(true);
    expect(isRefereeLevel("Regional")).toBe(true);
    expect(isRefereeLevel("IPF Cat. 1")).toBe(true);
    expect(isRefereeStatus("Sancionado")).toBe(true);
  });

  it("rechaza valores fuera de la whitelist y tipos no string", () => {
    expect(isEventType("AEP-4")).toBe(false);
    expect(isEventType("aep-1")).toBe(false);
    expect(isEventType(1)).toBe(false);
    expect(isRefereeLevel("Internacional")).toBe(false);
    expect(isRefereeLevel(null)).toBe(false);
    expect(isRefereeStatus("Baneado")).toBe(false);
    expect(isRefereeStatus(undefined)).toBe(false);
  });
});

describe("ISO_DATE_RE", () => {
  it("acepta AAAA-MM-DD y rechaza otros formatos", () => {
    expect(ISO_DATE_RE.test("2026-07-19")).toBe(true);
    expect(ISO_DATE_RE.test("19-07-2026")).toBe(false);
    expect(ISO_DATE_RE.test("2026/07/19")).toBe(false);
    expect(ISO_DATE_RE.test("2026-7-19")).toBe(false);
    expect(ISO_DATE_RE.test("2026-07-19T00:00:00Z")).toBe(false);
  });
});

describe("validateCompetitionFields", () => {
  it("acepta un payload completo válido", () => {
    expect(
      validateCompetitionFields({
        tipo: "AEP-2",
        fecha: "2026-05-01",
        fechaFin: "2026-05-02",
        sesiones: 3,
        requeridos: 9,
      }),
    ).toBeNull();
  });

  it("solo valida los campos presentes (PATCH parcial)", () => {
    expect(validateCompetitionFields({})).toBeNull();
    expect(validateCompetitionFields({ sesiones: 4 })).toBeNull();
  });

  it("rechaza tipo fuera del enum con mensaje que lista los permitidos", () => {
    const msg = validateCompetitionFields({ tipo: "AEP-9" });
    expect(msg).toContain("Tipo de campeonato no válido");
    for (const t of EVENT_TYPES) expect(msg).toContain(t);
  });

  it("rechaza fechas mal formateadas", () => {
    expect(validateCompetitionFields({ fecha: "01/05/2026" })).toContain("AAAA-MM-DD");
    expect(validateCompetitionFields({ fechaFin: "mañana" })).toContain("AAAA-MM-DD");
  });

  it("rechaza fechaFin anterior a fecha", () => {
    expect(
      validateCompetitionFields({ fecha: "2026-05-02", fechaFin: "2026-05-01" }),
    ).toContain("anterior");
  });

  it("usa el baseline para el cruce de fechas en PATCH parciales", () => {
    const baseline = { fecha: "2026-05-10", fechaFin: "2026-05-11" };
    // Mover la fechaFin por delante del inicio actual → inválido.
    expect(validateCompetitionFields({ fechaFin: "2026-05-09" }, baseline)).toContain("anterior");
    // Mover la fecha de inicio por detrás del fin actual → válido.
    expect(validateCompetitionFields({ fecha: "2026-05-01" }, baseline)).toBeNull();
    // Sin tocar fechas, un baseline incoherente no debe disparar el error.
    expect(validateCompetitionFields({ sesiones: 2 }, { fecha: "2026-05-10", fechaFin: "2026-05-01" })).toBeNull();
  });

  it("rechaza sesiones y requeridos fuera de rango", () => {
    expect(validateCompetitionFields({ sesiones: 0 })).toContain("entre 1 y 6");
    expect(validateCompetitionFields({ sesiones: 7 })).toContain("entre 1 y 6");
    expect(validateCompetitionFields({ sesiones: Number.NaN })).toContain("entre 1 y 6");
    expect(validateCompetitionFields({ requeridos: 0 })).toContain("al menos 1");
    expect(validateCompetitionFields({ requeridos: Number.POSITIVE_INFINITY })).toContain("al menos 1");
  });
});
