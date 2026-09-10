import { describe, expect, it } from "vitest";
import {
  deduceMacroZone,
  normalizeZoneInput,
  resolveZoneCode,
  zonesMatch,
  zoneDisplayName,
} from "@/lib/aep-zones";

/**
 * Dos de las cinco zonas llevan tilde en español: Andalucía y Mediterráneo.
 * `normalizeZoneKey` solo pasaba a mayúsculas, así que escritas como se
 * escriben no resolvían: ni el mapa de alias casaba, ni el
 * `includes("ANDALUCIA")` de la búsqueda parcial, porque la Í no es una I.
 *
 * `zona` es texto libre en informes, propuestas y solicitudes de ascenso —la
 * migración 013 no normalizó esas tablas—, así que una fila escrita a mano
 * como «Andalucía» no la reconocía como suya su propio delegado. Es
 * exactamente lo que `zonesMatch` existe para evitar.
 *
 * Y en un perfil es peor: `profileToSessionUser` guarda
 * `resolveZoneCode(zona)`, de modo que un delegado con «Andalucía» en su
 * ficha se queda sin zona resoluble y, con el filtro cerrado, sin ver nada.
 */

describe("las zonas que llevan tilde", () => {
  it("resuelven escritas con ella", () => {
    expect(resolveZoneCode("Andalucía")).toBe("ANDALUCIA");
    expect(resolveZoneCode("ANDALUCÍA")).toBe("ANDALUCIA");
    expect(resolveZoneCode("Mediterráneo")).toBe("MEDITERRANEO");
  });

  it("y también con el prefijo del Excel", () => {
    expect(resolveZoneCode("4- ANDALUCÍA")).toBe("ANDALUCIA");
    expect(resolveZoneCode("3- MEDITERRÁNEO")).toBe("MEDITERRANEO");
  });

  it("un delegado reconoce como suya una fila escrita con tilde", () => {
    expect(zonesMatch("Andalucía", "ANDALUCIA")).toBe(true);
    expect(zonesMatch("ANDALUCIA", "Andalucía")).toBe(true);
    expect(zonesMatch("Mediterráneo", "3- MEDITERRANEO")).toBe(true);
  });

  it("y un perfil con tilde deja de quedarse sin zona", () => {
    expect(normalizeZoneInput("Andalucía")).toBe("ANDALUCIA");
    expect(zoneDisplayName("Andalucía")).toBe("4- ANDALUCIA");
  });
});

describe("lo que no cambia", () => {
  it("sin tilde sigue funcionando igual", () => {
    expect(resolveZoneCode("Andalucia")).toBe("ANDALUCIA");
    expect(resolveZoneCode("2- CENTRO")).toBe("CENTRO");
    expect(resolveZoneCode("MAD")).toBe("CENTRO");
  });

  it("y lo que no es una zona sigue sin serlo", () => {
    expect(resolveZoneCode("Levante")).toBeUndefined();
    expect(resolveZoneCode("")).toBeUndefined();
    expect(resolveZoneCode(null)).toBeUndefined();
    expect(normalizeZoneInput("Levante")).toBeNull();
    expect(zonesMatch("Levante", "ANDALUCIA")).toBe(false);
  });

  it("no se confunden dos zonas distintas", () => {
    expect(zonesMatch("Andalucía", "MEDITERRANEO")).toBe(false);
    expect(zonesMatch("Mediterráneo", "ANDALUCIA")).toBe(false);
  });

  it("la deducción por provincia, que ya quitaba acentos, sigue igual", () => {
    expect(deduceMacroZone("Málaga", "")).toBe("ANDALUCIA");
    expect(deduceMacroZone(undefined, "Madrid")).toBe("CENTRO");
  });
});
