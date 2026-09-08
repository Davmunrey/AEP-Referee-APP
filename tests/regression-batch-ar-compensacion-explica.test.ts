import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  provisionalTotalLabel,
  RECEIPT_INCOMPLETE_HINT,
} from "@/lib/judge-compensation/readiness";

describe("el panel de compensación dice lo que sabe", () => {
  // El rótulo decía «Provisional (sin km)» siempre, también cuando ya había km
  // metidos y el importe sí los incluía: la cifra y su rótulo contaban cosas
  // distintas.
  it("el total provisional dice de cuántos jueces faltan los km", () => {
    expect(provisionalTotalLabel(0)).toBe("Provisional");
    expect(provisionalTotalLabel(1)).toBe("Provisional · falta el km de 1 juez");
    expect(provisionalTotalLabel(3)).toBe("Provisional · faltan los km de 3 jueces");
  });

  it("nunca dice «sin km» cuando ya no faltan", () => {
    expect(provisionalTotalLabel(0)).not.toMatch(/km/);
  });

  it("el botón de recibo apagado explica por qué", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/competitions/compensation-board.tsx"),
      "utf8",
    );
    // Deshabilitado y sin explicación: quien lo mira no puede saber que lo
    // único que falta son los km.
    expect(src).toContain("title={claim.financialComplete ? undefined : RECEIPT_INCOMPLETE_HINT}");
    expect(RECEIPT_INCOMPLETE_HINT).toMatch(/km/);
  });
});
