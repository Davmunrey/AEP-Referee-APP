import { describe, expect, it } from "vitest";
import { COMPETICION_ROLES_AEP2, PESAJE_ROLES, cloneRosterRoles } from "@/lib/mock-data";
import { looksLikeLayout, parseQuadrantLayout } from "@/lib/quadrant-layout-parser";
import type { Referee, RosterSession } from "@/lib/types";

// Texto real `pdftotext -layout` del cuadrante VISODESANJUAN: las CABECERAS de
// sesión están escalonadas (SESION 3, SESIÓN 1, SESION 2 en líneas distintas),
// pero el time-row y las filas de jueces están alineados en columnas.
const LAYOUT = `                                 sábado, 28 de marzo de 2026
                                                                           SESION 3
       SESIÓN 1
                                                                 PRESS BANCA RAW MUJERES
   POWERLIFTING RAW
                                          SESION 2                   (Todas las categorías)
   MUJERES (Todas las
                              POWERLIFTING RAW HOMBRES           PRESS BANCA RAW HOMBRES
      categorías)
                                -59 -66 -74 -93 -105 -120 kg         (Todas las categorías)
   POWERLIFTING RAW
    HOMBRES -83 kg
       10:00 - 13:15                  13:45 - 16:30                      17:00 - 19:00
    Raquel Martín Tomás        Samuel Roncada Grimaldos          Ester Abarquero Diezhandino
Ester Abarquero Diezhandino       Jose Carlos Cayuela             Samuel Roncada Grimaldos
       Julián Godínez               Julián Godínez                       Irene Zamora
 Samuel Roncada Grimaldos           Jose Carretero                      Moisés Jiménez
     Jose Carlos Cayuela         Raquel Martín Tomás                    Jose Carretero
       Moisés Jiménez                Irene Zamora                              -`;

const NAMES = [
  "Raquel Martín Tomás",
  "Ester Abarquero Diezhandino",
  "Julián Godínez",
  "Samuel Roncada Grimaldos",
  "Jose Carlos Cayuela",
  "Moisés Jiménez",
  "Jose Carretero",
  "Irene Zamora",
];

function referee(nombre: string, i: number): Referee {
  return {
    id: `r${i}`, nombre, zona: "CENTRO", nivel: "Nacional", estado: "Activo",
    eventos: 0, ultimo: "", disp: true, iniciales: "XX",
  };
}

function tpl(sesion: string): RosterSession {
  return {
    sesion, nombre: `Sesión ${sesion.slice(1)}`, dia: "Sábado 28 mar",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "10:00 - 13:15", horarioPesaje: "08:00 - 09:30",
    roles: cloneRosterRoles(COMPETICION_ROLES_AEP2), pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  };
}

describe("parseQuadrantLayout · cabeceras escalonadas (VISODESANJUAN)", () => {
  const referees = NAMES.map(referee);
  const template = [tpl("S1"), tpl("S2"), tpl("S3")];
  const { candidates } = parseQuadrantLayout(LAYOUT, referees, template);
  const at = (slotKey: string) => candidates.find((c) => c.slotKey === slotKey)?.refereeName;

  it("detecta layout pese a cabeceras escalonadas", () => {
    expect(looksLikeLayout(LAYOUT)).toBe(true);
  });

  it("asigna columnas correctas usando los centros del time-row", () => {
    // S1 columna izquierda
    expect(at("S1_central_0")).toBe("Raquel Martín Tomás");
    expect(at("S1_lateral_0")).toBe("Ester Abarquero Diezhandino");
    expect(at("S1_lateral_1")).toBe("Julián Godínez");
    // S2 columna central
    expect(at("S2_central_0")).toBe("Samuel Roncada Grimaldos");
    expect(at("S2_lateral_0")).toBe("Jose Carlos Cayuela");
    // S3 columna derecha
    expect(at("S3_central_0")).toBe("Ester Abarquero Diezhandino");
    expect(at("S3_lateral_0")).toBe("Samuel Roncada Grimaldos");
  });

  it("no mezcla columnas entre sesiones", () => {
    // Raquel está en S1 central; NO debe aparecer en S2/S3 central.
    expect(at("S2_central_0")).not.toBe("Raquel Martín Tomás");
    expect(at("S3_central_0")).not.toBe("Raquel Martín Tomás");
  });
});
