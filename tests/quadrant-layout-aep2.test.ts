import { describe, expect, it } from "vitest";
import { COMPETICION_ROLES_AEP2, PESAJE_ROLES, cloneRosterRoles } from "@/lib/mock-data";
import { parseQuadrantLayout } from "@/lib/quadrant-layout-parser";
import type { Referee, RosterSession } from "@/lib/types";

// Texto real `pdftotext -layout` del cuadrante AEP-2 Intend Power:
// cabeceras "SESION N" (no "Sn") y bloque de pesaje detectado por el 2º horario.
const LAYOUT = `         SESION 1                      SESION 2                               SESION 3
   HOMBRES -83 (B) -83 (A) kg            MUJERES -63 -69 -84 kg           HOMBRES -74 -105 kg
          10:00 - 13:30                       14:00 - 17:00                    17:30 - 20:30
     Irene Gálvez Santamaría           Cristabel Valpradinhos Días      Marco Herrera Hernández
    Guillermo González López               Ana Vázquez Perez           Cristabel Valpradinhos Días
    Marco Herrera Hernández               María González Peña            Irene Gálvez Santamaría
      Alejandro Pérez García             Alejandro Pérez García          Alejandro Pérez García
      María González Peña               Guillermo González López             Ana Vázquez Perez
       Ana Vázquez Perez                 Irene Gálvez Santamaría            María González Peña

          08:00 - 09:30                       12:00 - 13:30                    15:30 - 17:00

     María González Peña ↑↓            Cristabel Valpradinhos Días      Marco Herrera Hernández
   Marco Herrera Hernández ↑↓

           CENTRAL                             CONTROL                           PESAJE
           LATERAL                     LIFTINGCAST / OPENLIFTER               EQUIPAMIENTO`;

const NAMES = [
  "Irene Gálvez Santamaría",
  "Guillermo González López",
  "Marco Herrera Hernández",
  "Alejandro Pérez García",
  "María González Peña",
  "Ana Vázquez Perez",
  "Cristabel Valpradinhos Días",
];

function referee(nombre: string, i: number): Referee {
  return {
    id: `r${i}`, nombre, zona: "MADRID", nivel: "Nacional", estado: "Activo",
    eventos: 0, ultimo: "", disp: true, iniciales: "XX",
  };
}

function tpl(sesion: string): RosterSession {
  return {
    sesion, nombre: `Sesión ${sesion.slice(1)}`, dia: "Sábado 28 feb",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "10:00 - 13:30", horarioPesaje: "08:00 - 09:30",
    roles: cloneRosterRoles(COMPETICION_ROLES_AEP2), pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  };
}

describe("parseQuadrantLayout · AEP-2 (SESION N + pesaje por 2º horario)", () => {
  const referees = NAMES.map(referee);
  const template = [tpl("S1"), tpl("S2"), tpl("S3")];
  const { candidates } = parseQuadrantLayout(LAYOUT, referees, template);
  const at = (slotKey: string) => candidates.find((c) => c.slotKey === slotKey)?.refereeName;

  it("detecta cabeceras 'SESION N' y asigna competición S1 correctamente", () => {
    // COMPETICION_ROLES_AEP2: central, lateral×2, ordenador, control, speaker
    expect(at("S1_central_0")).toBe("Irene Gálvez Santamaría");
    expect(at("S1_lateral_0")).toBe("Guillermo González López");
    expect(at("S1_lateral_1")).toBe("Marco Herrera Hernández");
    expect(at("S1_ordenador_0")).toBe("Alejandro Pérez García");
    expect(at("S1_control_0")).toBe("María González Peña");
    expect(at("S1_speaker_0")).toBe("Ana Vázquez Perez");
  });

  it("asigna columnas S2 y S3", () => {
    expect(at("S2_central_0")).toBe("Cristabel Valpradinhos Días");
    expect(at("S3_central_0")).toBe("Marco Herrera Hernández");
  });

  it("detecta el bloque de pesaje por el 2º horario (sin marcador PESAJE)", () => {
    expect(at("S1_pesaje_0")).toBe("María González Peña");
    expect(at("S1_equipamiento_0")).toBe("Marco Herrera Hernández");
    expect(at("S2_pesaje_0")).toBe("Cristabel Valpradinhos Días");
    expect(at("S3_pesaje_0")).toBe("Marco Herrera Hernández");
  });

  it("captura el flag de intercambio (↑↓) en pesaje", () => {
    const c = candidates.find((c) => c.slotKey === "S1_pesaje_0");
    expect(c?.flags?.intercambio).toBe(true);
  });

  it("no mezcla roles dentro de la competición de S1", () => {
    const compRoles = new Set(["central", "lateral", "ordenador", "control", "speaker"]);
    const s1 = candidates.filter((c) => c.session === "S1" && c.refereeId && compRoles.has(c.roleKey));
    const ids = s1.map((c) => c.refereeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
