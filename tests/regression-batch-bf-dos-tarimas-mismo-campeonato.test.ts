import { describe, expect, it } from "vitest";
import { parsedToRosterTemplate } from "@/lib/schedule-parser/to-roster-template";
import { getPresetForEventType } from "@/lib/roster-template";
import { enumerateSlotKeys } from "@/lib/roster-template";
import type { EventType } from "@/lib/types";
import type { ParsedHorario } from "@/lib/schedule-parser/types";

/** Un horario mínimo con una sesión, como el que sale de un PDF. */
function horario(): ParsedHorario {
  return {
    sessions: [
      {
        sesion: "S1",
        nombre: "Sesión 1",
        dia: { raw: "Sábado", short: "Sáb" },
        categorias: [{ genero: "Hombres", pesos: "-74 kg" }],
        rawCategoria: "-74 kg",
        horarioCompeticion: "10:00 - 13:00",
        horarioPesaje: "08:00 - 09:30",
        grupos: [],
      },
    ],
  } as unknown as ParsedHorario;
}

const TIPOS: EventType[] = ["AEP-1", "AEP-2", "AEP-3"];

const rolesDe = (roles: { key: string; slots: number }[]) =>
  roles.map((r) => `${r.key}×${r.slots}`).sort();

describe("importar el horario y generar la plantilla montan la misma tarima", () => {
  // Había dos tablas de roles: `GEN_ROLES_*` para «Generar plantilla» y
  // `COMPETICION_ROLES_*` para la importación del horario, y no coincidían.
  // En un AEP-2 la importación montaba 6 puestos por sesión con Liftingcast y
  // Mesa, y el generador 7 con Ordenador y Speaker: mismo campeonato, dos
  // tarimas distintas según el botón que se pulsara.
  it.each(TIPOS)("mismos roles y mismas plazas en %s", (tipo) => {
    const importada = parsedToRosterTemplate(horario(), tipo);
    const generada = getPresetForEventType(tipo);
    expect(rolesDe(importada[0]!.roles)).toEqual(rolesDe(generada[0]!.roles));
  });

  it.each(TIPOS)("y por tanto la misma cobertura objetivo por sesión en %s", (tipo) => {
    const importada = parsedToRosterTemplate(horario(), tipo);
    const generada = getPresetForEventType(tipo);
    const huecosPorSesion = (t: typeof importada) =>
      enumerateSlotKeys([t[0]!]).length;
    expect(huecosPorSesion(importada)).toBe(huecosPorSesion(generada));
  });

  it("el AEP-1 sigue trayendo el jurado", () => {
    const importada = parsedToRosterTemplate(horario(), "AEP-1");
    expect(importada[0]!.roles.some((r) => r.key === "jurado")).toBe(true);
  });

  it("el bloque de pesaje se mantiene en la importación", () => {
    const importada = parsedToRosterTemplate(horario(), "AEP-2");
    expect(importada[0]!.pesajeRoles.map((r) => r.key)).toEqual(["pesaje", "equipamiento"]);
  });
});
