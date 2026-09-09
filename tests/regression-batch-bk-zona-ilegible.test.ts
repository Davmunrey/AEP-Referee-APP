import { describe, expect, it } from "vitest";
import { zoneScopeOf, zoneVisibilityFilter } from "@/lib/zone-scope";
import { canManageSanctions } from "@/lib/permissions";
import { canEditRoster } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";

const usuario = (role: SessionUser["role"], zona?: string): SessionUser =>
  ({ id: "u1", nombre: "D", role, zona }) as SessionUser;

/**
 * Una zona que la aplicación no sabe resolver —mal escrita en el perfil, un
 * resto de una versión anterior, una mano en el editor de Supabase— se
 * confundía con «este usuario no tiene restricción de zona». Son cosas
 * distintas, y tratarlas igual abre en vez de cerrar.
 */

describe("los tres ámbitos de zona son tres, no dos", () => {
  it("quien no es delegado de zona no tiene restricción", () => {
    expect(zoneScopeOf(usuario("super_admin")).kind).toBe("all");
    expect(zoneScopeOf(usuario("delegado_jueces")).kind).toBe("all");
    expect(zoneScopeOf(usuario("responsable_financiero_jueces")).kind).toBe("all");
    expect(zoneScopeOf(undefined).kind).toBe("all");
  });

  it("un delegado con zona reconocible queda restringido a ella", () => {
    expect(zoneScopeOf(usuario("delegado_zona", "CENTRO"))).toEqual({
      kind: "zone",
      code: "CENTRO",
    });
    // Y los códigos legados siguen resolviéndose.
    expect(zoneScopeOf(usuario("delegado_zona", "MAD"))).toEqual({
      kind: "zone",
      code: "CENTRO",
    });
  });

  it("un delegado con zona ilegible no es «sin restricción»", () => {
    expect(zoneScopeOf(usuario("delegado_zona", "Zona Rara")).kind).toBe("unresolved");
    expect(zoneScopeOf(usuario("delegado_zona", "")).kind).toBe("unresolved");
    expect(zoneScopeOf(usuario("delegado_zona", undefined)).kind).toBe("unresolved");
  });
});

describe("el filtro de visibilidad", () => {
  it("sin restricción se ve todo, incluidas las filas con zona rara", () => {
    const ve = zoneVisibilityFilter(usuario("super_admin"));
    expect(ve("CENTRO")).toBe(true);
    expect(ve("Vete a saber")).toBe(true);
    expect(ve(null)).toBe(true);
  });

  it("con zona reconocible se ve solo la suya", () => {
    const ve = zoneVisibilityFilter(usuario("delegado_zona", "CENTRO"));
    expect(ve("CENTRO")).toBe(true);
    expect(ve("MAD")).toBe(true); // mismo código canónico
    expect(ve("ANDALUCIA")).toBe(false);
    expect(ve("Vete a saber")).toBe(false);
  });

  it("con zona ilegible no se ve nada", () => {
    // Antes caía en el `!userZone` de los filtros y se le enseñaba el censo,
    // el calendario y el panel de TODAS las zonas.
    const ve = zoneVisibilityFilter(usuario("delegado_zona", "Zona Rara"));
    expect(ve("CENTRO")).toBe(false);
    expect(ve("Zona Rara")).toBe(false);
    expect(ve(null)).toBe(false);
  });
});

describe("sancionar con la zona ilegible", () => {
  it("dos zonas ilegibles distintas ya no dan permiso", () => {
    // `resolveZoneCode` devolvía `undefined` en los dos lados y
    // `undefined === undefined` es `true`: un delegado con la zona mal escrita
    // podía sancionar a un juez de cualquier otra zona igual de ilegible. Y
    // sancionar deja al juez no disponible para designaciones.
    expect(canManageSanctions(usuario("delegado_zona", "Zona Rara"), "Otra Cosa")).toBe(false);
    expect(canManageSanctions(usuario("delegado_zona", "XXX"), "YYY")).toBe(false);
    expect(canManageSanctions(usuario("delegado_zona", "XXX"), "XXX")).toBe(false);
  });

  it("y la zona propia sigue funcionando", () => {
    expect(canManageSanctions(usuario("delegado_zona", "CENTRO"), "CENTRO")).toBe(true);
    expect(canManageSanctions(usuario("delegado_zona", "CENTRO"), "MAD")).toBe(true);
    expect(canManageSanctions(usuario("delegado_zona", "CENTRO"), "ANDALUCIA")).toBe(false);
    expect(canManageSanctions(usuario("super_admin"), "CENTRO")).toBe(true);
  });

  it("su hermana `canEditRoster` ya cortaba, y sigue igual", () => {
    // El contraste que delataba el fallo: la misma comprobación, una con el
    // `!!` y la otra sin él.
    expect(canEditRoster(usuario("delegado_zona", "Zona Rara"), "Otra Cosa")).toBe(false);
    expect(canEditRoster(usuario("delegado_zona", "CENTRO"), "CENTRO")).toBe(true);
  });
});
