import { describe, expect, it } from "vitest";
import {
  COMPETICION_ROLES_AEP1,
  PESAJE_ROLES,
  cloneRosterRoles,
} from "@/lib/mock-data";
import { parseQuadrantAssignments } from "@/lib/quadrant-parser";
import type { Referee, RosterSession } from "@/lib/types";

function referee(nombre: string, index: number): Referee {
  return {
    id: `r${index}`,
    nombre,
    zona: "CENTRO",
    nivel: "IPF Cat. 2",
    estado: "Activo",
    eventos: 0,
    ultimo: "",
    disp: true,
    iniciales: nombre
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2),
  };
}

function template(sessions: string[]): RosterSession[] {
  return sessions.map((sesion) => ({
    sesion,
    nombre: `Sesión ${sesion.slice(1)}`,
    dia: "Viernes",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "12:00 - 15:00",
    horarioPesaje: "10:00 - 11:30",
    roles: cloneRosterRoles(COMPETICION_ROLES_AEP1),
    pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  }));
}

describe("parseQuadrantAssignments", () => {
  it("separa competición y pesaje cuando el PDF repite cabeceras de sesión", () => {
    const names = [
      "Ana Vazquez",
      "Isa Garcia",
      "Marta Gomez",
      "Ana Roa",
      "Yerai Vega",
      "Herminio Muedra",
      "Ceila Alonso",
      "Alejandro Pérez",
      "Raquel Martin",
      "Javi Ruiz",
      "Carlos Bustillo",
      "Sergio Alvarez",
    ];
    const text = `
      Página 1 de 1
      S1
      Hombres -74kg
      S2
      Hombres -83kg
      12:30 - 15:45 16:00 - 18:15
      Ana Vazquez Isa Garcia
      Marta Gomez Ana Roa
      Yerai Vega Herminio Muedra
      Ceila Alonso Alejandro Pérez
      Raquel Martin Javi Ruiz
      Ana Vazquez Isa Garcia
      Marta Gomez Ana Roa
      Yerai Vega Herminio Muedra
      Ceila Alonso Alejandro Pérez
      S1
      Hombres -74kg
      S2
      Hombres -83kg
      10:30 - 12:00 14:00 - 15:30
      Javi Ruiz Carlos Bustillo
      Raquel Martin Sergio Alvarez
      JUEZ CENTRAL SPEAKER / MESA PESAJE
      JUEZ LATERAL JUEZ CONTROL CONTROL DE EQUIPAMIENTO
      ORDENADOR JURADO
    `;

    const parsed = parseQuadrantAssignments(
      text,
      names.map(referee),
      template(["S1", "S2"]),
    );

    expect(parsed.warnings).toEqual([]);
    expect(parsed.candidates).toHaveLength(22);
    expect(parsed.candidates.filter((c) => c.importable)).toHaveLength(22);
    expect(parsed.candidates.filter((c) => c.roleKey === "jurado")).toHaveLength(6);
    expect(parsed.candidates.filter((c) => c.roleKey === "pesaje")).toHaveLength(2);
    expect(parsed.candidates.filter((c) => c.roleKey === "equipamiento")).toHaveLength(2);
  });

  it("omite horarios sin leyenda de roles para evitar falsos positivos", () => {
    const parsed = parseQuadrantAssignments(
      `
        S1
        Hombres -74kg
        12:30 - 15:45
        Ana Vazquez
        Campeonato con texto suficientemente largo para simular horario extraído de PDF,
        pero sin leyenda operativa de roles ni tabla real de cuadrante de jueces.
      `,
      [referee("Ana Vazquez", 1)],
      template(["S1"]),
    );

    expect(parsed.candidates).toEqual([]);
    expect(parsed.warnings.join(" ")).toContain("sin leyenda de roles");
  });

  it("asigna cuadrantes AEP con bloque único según orden real AEP", () => {
    const names = [
      "Ana Vázquez Perez",
      "Isa Garcia",
      "Herminio Muedra Alarcón",
      "Alejandro Pérez García",
      "Yerai Vega",
      "Ceila Alonso",
      "Javi Ruiz",
      "Raquel Martín Tomás",
      "Sergio Álvarez Delgado",
    ];
    const parsed = parseQuadrantAssignments(
      `
        Página 1 de 1
        S1
        Hombres
        -74kg (C) -83kg (C)
        12:30 - 15:45
        Ana Vázquez
        Isa Garcia
        Herminio Muedra
        Alejandro Pérez
        Yerai Vega
        Ceila Alonso
        Javi Ruiz
        Raquel Martín
        Sergio Álvarez
        JUEZ CENTRAL SPEAKER / MESA PESAJE
        JUEZ LATERAL JUEZ CONTROL CONTROL DE EQUIPAMIENTO
        ORDENADOR JURADO
      `,
      names.map(referee),
      template(["S1"]),
    );

    const byRef = new Map(parsed.candidates.map((c) => [c.refereeName, c.roleKey]));

    // Orden real AEP: central → lateral → lateral → ordenador → speaker → control
    expect(byRef.get("Ana Vázquez Perez")).toBe("central");
    expect(byRef.get("Isa Garcia")).toBe("lateral");
    expect(byRef.get("Herminio Muedra Alarcón")).toBe("lateral");
    expect(byRef.get("Alejandro Pérez García")).toBe("ordenador");
    expect(byRef.get("Yerai Vega")).toBe("speaker");
    expect(byRef.get("Ceila Alonso")).toBe("control");
    expect(byRef.get("Javi Ruiz")).toBe("pesaje");
    expect(byRef.get("Raquel Martín Tomás")).toBe("equipamiento");
    expect(byRef.get("Sergio Álvarez Delgado")).toBe("jurado");
  });
});
