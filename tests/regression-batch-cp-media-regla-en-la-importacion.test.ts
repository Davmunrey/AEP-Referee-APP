import { describe, expect, it } from "vitest";
import { parseQuadrantAssignments } from "@/lib/quadrant-parser";
import { duplicateRoleKeys, enumerateSlotKeys } from "@/lib/roster-template";
import { rosterTemplateSchema } from "@/lib/validations";
import type { Referee, RosterSession } from "@/lib/types";

/**
 * Dentro de una sesión cada rol va en UNA fila con su número de plazas: dos
 * filas «Juez Central» comparten las claves `${sesion}_${rol}_${indice}`, así
 * que la segunda no aporta ningún hueco asignable.
 *
 * La regla se aplicaba al guardar a mano (`rosterTemplateSchema`) y en el
 * editor, que deshabilita el botón. La importación de cuadrante comprobaba
 * solo la MITAD —los códigos de sesión repetidos— y dejaba entrar la otra:
 * quien importaba ese PDF se encontraba una plantilla que el editor ya no le
 * dejaba guardar hasta quitar la fila de más.
 */

const CENTRAL = { rol: "Juez Central", slots: 1, key: "central" as const };

function sesion(codigo: string, roles: RosterSession["roles"]): RosterSession {
  return {
    sesion: codigo,
    nombre: `Sesión ${codigo}`,
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-83" }],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles,
    pesajeRoles: [],
  };
}

describe("dos filas del mismo rol en una sesión", () => {
  const conRepetido = [sesion("S1", [CENTRAL, { ...CENTRAL }])];

  it("no aportan un segundo hueco", () => {
    expect(enumerateSlotKeys(conRepetido)).toEqual(["S1_central_0"]);
  });

  it("las detecta el mismo ayudante que usan el esquema y el editor", () => {
    expect(duplicateRoleKeys(conRepetido[0]!)).toEqual(["central"]);
  });

  it("y el esquema de guardado a mano las rechaza", () => {
    expect(rosterTemplateSchema.safeParse(conRepetido).success).toBe(false);
  });

  it("una plantilla con cada rol en su fila sí pasa", () => {
    const limpia = [sesion("S1", [{ ...CENTRAL, slots: 2 }])];
    expect(duplicateRoleKeys(limpia[0]!)).toEqual([]);
    expect(rosterTemplateSchema.safeParse(limpia).success).toBe(true);
    expect(enumerateSlotKeys(limpia)).toEqual(["S1_central_0", "S1_central_1"]);
  });

  it("un rol repetido entre competición y pesaje cuenta igual", () => {
    const cruzado: RosterSession = {
      ...sesion("S1", [CENTRAL]),
      pesajeRoles: [{ rol: "Juez Central", slots: 1, key: "central" }],
    };
    expect(duplicateRoleKeys(cruzado)).toEqual(["central"]);
  });
});

/**
 * El aviso de «el documento trae N nombres y la plantilla tiene M puestos»
 * compara los nombres leídos con las plazas de la sesión, y esas plazas se
 * contaban sumando `slots`. Con un rol repetido, esa suma cuenta una plaza que
 * no existe: el aviso saltaba con el cuadrante bien leído y mandaba a revisar
 * a mano el rol de cada juez sin motivo.
 */
const JUEZ: Referee = {
  id: "r1",
  nombre: "Ana Vazquez",
  zona: "CENTRO",
  nivel: "IPF Cat. 2",
  estado: "Activo",
  eventos: 0,
  ultimo: "",
  disp: true,
  iniciales: "AV",
};

const CUADRANTE = `
        S1
        Hombres -83kg
        12:30 - 15:45
        Ana Vazquez
        JUEZ CENTRAL
      `;

function plantillaCuadrante(roles: RosterSession["roles"]): RosterSession[] {
  return [
    {
      sesion: "S1",
      nombre: "Sesión 1",
      dia: "Viernes",
      categorias: [{ genero: "Hombres", pesos: "-83kg" }],
      horarioCompeticion: "12:00 - 15:00",
      horarioPesaje: "10:00 - 11:30",
      roles,
      pesajeRoles: [],
    },
  ];
}

describe("el aviso de descuadre del cuadrante", () => {
  it("no salta cuando los nombres cubren los huecos que de verdad hay", () => {
    const conRepetido = plantillaCuadrante([CENTRAL, { ...CENTRAL }]);
    expect(enumerateSlotKeys(conRepetido)).toHaveLength(1);

    const parsed = parseQuadrantAssignments(CUADRANTE, [JUEZ], conRepetido);
    expect(parsed.candidates.map((c) => c.slotKey)).toEqual(["S1_central_0"]);
    expect(parsed.warnings).toEqual([]);
  });

  it("y sigue saltando cuando falta de verdad un nombre", () => {
    const dosPlazas = plantillaCuadrante([{ ...CENTRAL, slots: 2 }]);
    const parsed = parseQuadrantAssignments(CUADRANTE, [JUEZ], dosPlazas);
    expect(parsed.warnings.join(" ")).toContain("2 puesto(s)");
  });
});
