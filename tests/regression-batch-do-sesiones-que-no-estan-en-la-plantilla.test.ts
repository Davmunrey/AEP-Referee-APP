import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { looksLikeLayout, parseQuadrantLayout } from "@/lib/quadrant-layout-parser";
import { parseQuadrantAssignments } from "@/lib/quadrant-parser";
import { getPresetForEventType } from "@/lib/roster-template";
import type { Referee } from "@/lib/types";

/**
 * Un cuadrante con más sesiones que la plantilla.
 *
 * Es una situación normal: el cuadrante suele llegar antes que el horario, así
 * que la plantilla puede ser todavía el preset del tipo de campeonato. Los dos
 * lectores daban dos respuestas distintas, y ninguna servía:
 *
 *   - el de geometría empujaba «Sesión S10 no existe en la plantilla; se
 *     omite.» DENTRO del bucle de celdas, así que la vista previa repetía la
 *     misma línea una vez por cada fila de rol —veinte, en el cuadrante Junior
 *     real—;
 *   - el plano se limitaba a descartar esas sesiones sin decir nada, y quien
 *     importaba veía menos candidatos de los que esperaba sin saber por qué.
 *
 * Ahora los dos dicen lo mismo, una vez, nombrando las sesiones.
 */

const JUNIOR = readFileSync("tests/fixtures/cuadrantes/20260517_AEP1_Junior_rev3.txt", "utf8");

const NOMBRES = [
  "Ana Vázquez Perez", "Isa García Romero", "Marta Gómez Álvarez", "Yerai Vega Soto",
  "Ana Roa Sales", "Ceila Alonso González", "Alejandro Pérez García",
  "Herminio Muedra Alarcón", "Raquel Martín Tomás", "Javi Ruiz Lopez",
  "Sergio Álvarez Delgado", "Carlos Bustillo García",
];

const referees: Referee[] = NOMBRES.map((nombre, i) => ({
  id: `r${i}`,
  nombre,
  zona: "CENTRO",
  nivel: "IPF Cat. 2",
  estado: "Activo",
  eventos: 0,
  ultimo: "",
  disp: true,
  iniciales: "XX",
}));

// El preset AEP-1 llega hasta S4; el cuadrante real tiene sesiones más allá.
const PLANTILLA_CORTA = getPresetForEventType("AEP-1");

function avisosDeSesion(warnings: string[]): string[] {
  return warnings.filter((w) => w.includes("no están en la plantilla"));
}

describe("el lector por geometría", () => {
  const parsed = parseQuadrantLayout(JUNIOR, referees, PLANTILLA_CORTA);

  it("lo dice una sola vez, no una por fila de rol", () => {
    expect(avisosDeSesion(parsed.warnings)).toHaveLength(1);
  });

  it("y nombra la sesión que sobra", () => {
    expect(avisosDeSesion(parsed.warnings)[0]).toContain("S10");
  });

  it("sin dejar de emparejar el resto del cuadrante", () => {
    expect(parsed.candidates.length).toBeGreaterThan(0);
    expect(parsed.candidates.some((c) => c.importable)).toBe(true);
  });

  it("el fixture es de los que van por geometría", () => {
    expect(looksLikeLayout(JUNIOR)).toBe(true);
  });
});

describe("el lector plano", () => {
  const parsed = parseQuadrantAssignments(JUNIOR, referees, PLANTILLA_CORTA);

  it("ya no se calla las sesiones que descarta", () => {
    const avisos = avisosDeSesion(parsed.warnings);
    expect(avisos).toHaveLength(1);
    for (const sesion of ["S5", "S6", "S7", "S8", "S9", "S10"]) {
      expect(avisos[0]).toContain(sesion);
    }
  });

  it("y sigue emparejando las sesiones que sí están", () => {
    expect(parsed.candidates.length).toBeGreaterThan(0);
  });
});

describe("cuando la plantilla tiene todas las sesiones", () => {
  it("ninguno de los dos inventa el aviso", () => {
    const plantillaLarga = Array.from({ length: 10 }, (_, i) => ({
      ...PLANTILLA_CORTA[0]!,
      sesion: `S${i + 1}`,
      nombre: `Sesión ${i + 1}`,
    }));
    expect(avisosDeSesion(parseQuadrantLayout(JUNIOR, referees, plantillaLarga).warnings)).toEqual([]);
    expect(
      avisosDeSesion(parseQuadrantAssignments(JUNIOR, referees, plantillaLarga).warnings),
    ).toEqual([]);
  });
});
