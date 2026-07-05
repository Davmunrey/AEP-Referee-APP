import { describe, expect, it } from "vitest";
import { stripRefereePII, stripRefereeListPII } from "@/lib/api/referee-scope";
import type { Referee, SessionUser, UserRole } from "@/lib/types";

function user(role: UserRole): SessionUser {
  return {
    id: "u1",
    nombre: "Usuario",
    rol: "Rol",
    iniciales: "US",
    email: "user@example.com",
    role,
  };
}

function referee(): Referee {
  return {
    id: "j001",
    nombre: "Ana Ruiz",
    zona: "CENTRO",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 5,
    ultimo: "2026-01-01",
    disp: true,
    iniciales: "AR",
    email: "ana@example.com",
    telefono: "600123123",
    domicilio: "Calle Falsa 123, Madrid",
    domicilioLat: 40.4,
    domicilioLng: -3.7,
    notas: "nota interna",
    licencia: "LIC-1",
    localidad: "Madrid",
  };
}

describe("stripRefereePII", () => {
  it("elimina contacto, domicilio, coordenadas y notas para solo_ver", () => {
    const out = stripRefereePII(referee(), user("solo_ver"));
    expect(out.email).toBeUndefined();
    expect(out.telefono).toBeUndefined();
    expect(out.domicilio).toBeUndefined();
    expect(out.domicilioLat).toBeUndefined();
    expect(out.domicilioLng).toBeUndefined();
    expect(out.notas).toBeUndefined();
    // Conserva lo no sensible / operativo.
    expect(out.nombre).toBe("Ana Ruiz");
    expect(out.zona).toBe("CENTRO");
    expect(out.nivel).toBe("Nacional");
    expect(out.licencia).toBe("LIC-1");
  });

  it("conserva la PII para roles operativos (el financiero necesita el domicilio para km)", () => {
    for (const role of ["super_admin", "delegado_jueces", "delegado_zona", "responsable_financiero_jueces"] as UserRole[]) {
      const out = stripRefereePII(referee(), user(role));
      expect(out.email).toBe("ana@example.com");
      expect(out.domicilio).toBe("Calle Falsa 123, Madrid");
      expect(out.domicilioLat).toBe(40.4);
    }
  });

  it("stripRefereeListPII aplica el recorte a toda la lista para solo_ver", () => {
    const out = stripRefereeListPII([referee(), referee()], user("solo_ver"));
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.telefono === undefined && r.domicilio === undefined)).toBe(true);
  });
});
