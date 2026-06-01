import { describe, expect, it } from "vitest";
import { COMPETICION_ROLES_AEP1, PESAJE_ROLES, cloneRosterRoles } from "@/lib/mock-data";
import { looksLikeLayout, parseQuadrantLayout } from "@/lib/quadrant-layout-parser";
import type { Referee, RosterSession } from "@/lib/types";

// Texto real `pdftotext -layout` del cuadrante AEP-1 Junior (página 1: S1 S2 S3).
const LAYOUT = `                                     ASOCIACIÓN ESPAÑOLA de POWERLIFTING
                                     Campeonato de España Junior
                                     AEP-1 Nacional
                                     Las Torres de Cotillas, Murcia | 15, 16 y 17 de mayo de 2026

                                      Viernes - 15 de mayo de 2026

                S1                                 S2                                    S3
             Hombres                            Hombres                               Hombres
        -74kg (C) - 83kg (C)               -93kg (C) -93kg (B)                   -74kg (B) - 83kg (B)
           12:30 - 15:45                      16:00 - 18:15                         18:45 - 21:45
             Ana Vazquez                        Isa Garcia                           Marta Gomez
              Isa Garcia                         Ana Roa                              Yerai Vega
           Herminio Muedra                     Ceila Alonso                            Ana Roa
            Alejandro Pérez                   Alejandro Pérez                       Alejandro Pérez
              Yerai Vega                     Herminio Muedra                        Raquel Martin
             Ceila Alonso                       Yerai Vega*                           Isa Garcia
               Javi Ruiz                        Javi Ruiz*                             Javi Ruiz
            Raquel Martin                      Raquel Martin                       Herminio Muedra
            Sergio Alvarez                    Sergio Alvarez                        Sergio Alvarez

                                  PESAJE y REVISIÓN EQUIPAMIENTO

                S1                                 S2                                    S3
             Hombres                            Hombres                               Hombres
           10:30 - 12:00                      14:00 - 15:30                         16:45 - 18:15
               Javi Ruiz                      Carlos Bustillo                         Yerai Vega
            Raquel Martin                        Ana Roa

            JUEZ CENTRAL                     SPEAKER / MESA                             PESAJE
            JUEZ LATERAL                      JUEZ CONTROL                CONTROL DE EQUIPAMIENTO
             ORDENADOR                           JURADO`;

const NAMES = [
  "Ana Vázquez Perez",
  "Isa García Romero",
  "Marta Gómez Álvarez",
  "Yerai Vega Soto",
  "Ana Roa Sales",
  "Ceila Alonso González",
  "Alejandro Pérez García",
  "Herminio Muedra Alarcón",
  "Raquel Martín Tomás",
  "Javi Ruiz Lopez",
  "Sergio Álvarez Delgado",
  "Carlos Bustillo García",
];

function referee(nombre: string, i: number): Referee {
  return {
    id: `r${i}`, nombre, zona: "CENTRO", nivel: "IPF Cat. 2", estado: "Activo",
    eventos: 0, ultimo: "", disp: true, iniciales: "XX",
  };
}

function tpl(sesion: string): RosterSession {
  return {
    sesion, nombre: `Sesión ${sesion.slice(1)}`, dia: "Viernes 15 may",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "12:30 - 15:45", horarioPesaje: "10:30 - 12:00",
    roles: cloneRosterRoles(COMPETICION_ROLES_AEP1), pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  };
}

describe("parseQuadrantLayout", () => {
  const referees = NAMES.map(referee);
  const template = [tpl("S1"), tpl("S2"), tpl("S3")];
  const { candidates, warnings } = parseQuadrantLayout(LAYOUT, referees, template);
  const at = (slotKey: string) => candidates.find((c) => c.slotKey === slotKey)?.refereeName;

  it("detecta estructura de layout (columnas)", () => {
    expect(looksLikeLayout(LAYOUT)).toBe(true);
  });

  it("asigna la columna S1 a los roles correctos (sin duplicar)", () => {
    expect(at("S1_central_0")).toBe("Ana Vázquez Perez");
    expect(at("S1_lateral_0")).toBe("Isa García Romero");
    expect(at("S1_lateral_1")).toBe("Herminio Muedra Alarcón");
    expect(at("S1_ordenador_0")).toBe("Alejandro Pérez García");
    expect(at("S1_speaker_0")).toBe("Yerai Vega Soto");
    expect(at("S1_control_0")).toBe("Ceila Alonso González");
    expect(at("S1_jurado_0")).toBe("Javi Ruiz Lopez");
    expect(at("S1_jurado_1")).toBe("Raquel Martín Tomás");
    expect(at("S1_jurado_2")).toBe("Sergio Álvarez Delgado");
  });

  it("no duplica un juez dentro del bloque de competición de una sesión", () => {
    // (pesaje es un bloque horario distinto, sí puede repetir juez)
    const compRoles = new Set(["central", "lateral", "ordenador", "speaker", "control", "jurado"]);
    const s1 = candidates.filter(
      (c) => c.session === "S1" && c.refereeId && compRoles.has(c.roleKey),
    );
    const ids = s1.map((c) => c.refereeId);
    expect(new Set(ids).size).toBe(ids.length); // todos distintos en competición
  });

  it("asigna columnas S2 y S3 correctamente", () => {
    expect(at("S2_central_0")).toBe("Isa García Romero");
    expect(at("S2_lateral_0")).toBe("Ana Roa Sales");
    expect(at("S3_central_0")).toBe("Marta Gómez Álvarez");
    expect(at("S3_lateral_0")).toBe("Yerai Vega Soto");
  });

  it("maneja celda vacía en medio: pesaje S3 equipamiento queda sin emitir", () => {
    // Pesaje fila 2 solo tiene S1 (Raquel) y S2 (Ana Roa); S3 vacío.
    expect(at("S1_pesaje_0")).toBe("Javi Ruiz Lopez");
    expect(at("S2_pesaje_0")).toBe("Carlos Bustillo García");
    expect(at("S3_pesaje_0")).toBe("Yerai Vega Soto");
    expect(at("S1_equipamiento_0")).toBe("Raquel Martín Tomás");
    expect(at("S2_equipamiento_0")).toBe("Ana Roa Sales");
    expect(at("S3_equipamiento_0")).toBeUndefined(); // celda vacía -> no se inventa
  });

  it("detecta el flag de función compartida (*)", () => {
    const yerai = candidates.find((c) => c.slotKey === "S2_control_0");
    expect(yerai?.flags?.compartido).toBe(true);
  });

  it("no genera warnings de rejilla", () => {
    expect(warnings.join(" ")).not.toContain("No se detectó rejilla");
  });

  it("multi-bloque sin form-feed: el 2º bloque comp NO se trata como pesaje", () => {
    // Simula salida de pdf.js (páginas concatenadas sin \f): comp+pesaje (S1-S3), luego comp (S4-S6).
    const page2 = `                S4                                 S5                                    S6
             Hombres                            Hombres                               Hombres
           09:00 - 11:00                      11:30 - 13:30                         14:00 - 16:00
             Marta Gomez                        Yerai Vega                           Ana Vazquez`;
    const multi = LAYOUT + "\n" + page2;
    const tplAll = [tpl("S1"), tpl("S2"), tpl("S3"), tpl("S4"), tpl("S5"), tpl("S6")];
    const out = parseQuadrantLayout(multi, referees, tplAll);
    const get = (k: string) => out.candidates.find((c) => c.slotKey === k)?.refereeName;
    // El 2º bloque debe ir a central (competición), NO a pesaje.
    expect(get("S4_central_0")).toBe("Marta Gómez Álvarez");
    expect(get("S5_central_0")).toBe("Yerai Vega Soto");
    expect(get("S6_central_0")).toBe("Ana Vázquez Perez");
  });
});
