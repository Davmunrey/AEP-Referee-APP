import { describe, expect, it } from "vitest";
import { hasPdfSignature, parseSelectedImportKeys } from "@/lib/import-security";

describe("import-security", () => {
  it("valida selecciones de import con limites", () => {
    expect(parseSelectedImportKeys(null)).toBeNull();
    expect([...parseSelectedImportKeys(JSON.stringify(["S1", "S2"]))!]).toEqual(["S1", "S2"]);
    expect(() => parseSelectedImportKeys(JSON.stringify([""]))).toThrow("Selección inválida");
    expect(() => parseSelectedImportKeys(JSON.stringify(Array.from({ length: 501 }, (_, i) => `S${i}`)))).toThrow(
      "Demasiadas filas seleccionadas",
    );
  });

  it("detecta firma PDF real", () => {
    expect(hasPdfSignature(Buffer.from("%PDF-1.7"))).toBe(true);
    expect(hasPdfSignature(Buffer.from("not a pdf"))).toBe(false);
  });
});
