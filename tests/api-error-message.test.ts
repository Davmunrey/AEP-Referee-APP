import { describe, expect, it } from "vitest";
import { formatApiError } from "@/lib/api/error-message";

describe("formatApiError", () => {
  it("uses Error.message", () => {
    expect(formatApiError(new Error("Sin permiso"))).toBe("Sin permiso");
  });

  it("uses string errors", () => {
    expect(formatApiError("Datos inválidos")).toBe("Datos inválidos");
  });

  it("falls back for unknown values", () => {
    expect(formatApiError(null, "Fallo")).toBe("Fallo");
  });
});
