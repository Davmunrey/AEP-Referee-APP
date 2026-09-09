import { describe, expect, it } from "vitest";
import { parseIntegerKm } from "@/lib/judge-compensation/km";

/**
 * El campo de km es de texto, así que se puede escribir «1.234». Y
 * `Number("1.234")` es 1,234, que redondeado son 1 km: mil doscientos treinta
 * y cuatro kilómetros de ida y vuelta cobrados como uno, sin que nada lo
 * dijera. A 0,13 €/km son 160 € que se quedan en 13 céntimos.
 */
describe("kilómetros tecleados a la española", () => {
  it("el punto de millares es de millares", () => {
    expect(parseIntegerKm("1.234")).toBe(1234);
    expect(parseIntegerKm("12.345")).toBe(12345);
    expect(parseIntegerKm("1.234.567")).toBe(1234567);
  });

  it("la coma sigue siendo el decimal", () => {
    expect(parseIntegerKm("1,5")).toBe(2);
    expect(parseIntegerKm("120,4")).toBe(120);
  });

  it("un punto que no es de millares se lee como decimal, como antes", () => {
    expect(parseIntegerKm("1.5")).toBe(2);
    expect(parseIntegerKm("12.34")).toBe(12);
  });

  it("lo que no es un número sigue siendo nulo", () => {
    expect(parseIntegerKm("1.234,5")).toBe(1235);
    expect(parseIntegerKm("abc")).toBeNull();
    expect(parseIntegerKm("-3")).toBeNull();
    expect(parseIntegerKm("")).toBeNull();
  });

  it("un número ya numérico no cambia", () => {
    expect(parseIntegerKm(1234)).toBe(1234);
    expect(parseIntegerKm(0)).toBe(0);
  });
});
