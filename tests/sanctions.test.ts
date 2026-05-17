import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  buildSanctionMailto,
  isSanctionActive,
  resolveSanctionEndDate,
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
