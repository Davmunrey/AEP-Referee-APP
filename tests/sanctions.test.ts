import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  buildSanctionMailto,
  daysUntil,
  isSanctionActive,
  resolveSanctionEndDate,
  todayIso,
} from "@/lib/sanctions";

describe("sanctions", () => {
  it("resolves preset duration", () => {
    expect(resolveSanctionEndDate("2026-03-01", "7d")).toBe("2026-03-08");
    expect(resolveSanctionEndDate("2026-03-01", "30d")).toBe("2026-03-31");
  });

  it("detects active sanction by date", () => {
    const future = addDaysIso(new Date().toISOString().slice(0, 10), 10);
    expect(
      isSanctionActive({ status: "activa", fechaFin: future }),
    ).toBe(true);
    expect(
      isSanctionActive({ status: "revocada", fechaFin: future }),
    ).toBe(false);
  });

  it("todayIso devuelve AAAA-MM-DD en la zona de negocio", () => {
    const today = todayIso();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Debe coincidir con el día natural en Europe/Madrid, no con el día UTC.
    const madridDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
      new Date(),
    );
    expect(today).toBe(madridDay);
  });

  it("daysUntil cuenta días naturales incluyendo el día de fin", () => {
    const today = todayIso();
    expect(daysUntil(today)).toBe(1); // termina hoy → queda 1 día (hoy)
    expect(daysUntil(addDaysIso(today, 1))).toBe(2);
    expect(daysUntil(addDaysIso(today, -1))).toBe(0); // terminó ayer
    expect(daysUntil(addDaysIso(today, -2))).toBe(-1);
    expect(daysUntil("no-es-fecha")).toBe(0);
  });

  it("una sanción que termina hoy sigue activa todo el día local", () => {
    expect(isSanctionActive({ status: "activa", fechaFin: todayIso() })).toBe(true);
  });

  it("builds mailto for delegates", () => {
    const url = buildSanctionMailto(
      [{ id: "1", nombre: "Delegado", email: "zona@test.com" }],
      {
        refereeName: "Juan Pérez",
        motivo: "Incidencia grave",
        fechaInicio: "2026-03-01",
        fechaFin: "2026-03-31",
        zona: "CENTRO",
        impuestaPorNombre: "Admin",
      },
    );
    expect(url).toContain("mailto:zona@test.com");
    expect(url).toContain("Juan");
  });
});
