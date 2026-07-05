import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPETICION_ROLES_AEP2,
  PESAJE_ROLES,
  cloneRosterRoles,
} from "@/lib/mock-data";
import { parseQuadrantAssignments } from "@/lib/quadrant-parser";
import type { Referee, RosterSession } from "@/lib/types";

/**
 * Corpus de cuadrantes AEP reales de la temporada 2026 (texto extraído de los
 * PDF oficiales). Blinda el parser contra regresiones con datos de campo:
 * variantes de etiqueta de sesión, bloque de pesaje, multi-tarima y PDFs imagen.
 */
const FIXTURES_DIR = join(__dirname, "fixtures", "cuadrantes");
const fixtures = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".txt"))
  .sort();

function referee(nombre: string, index: number): Referee {
  return {
    id: `r${index}`,
    nombre,
    zona: "CENTRO",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 0,
    ultimo: "",
    disp: true,
    iniciales: nombre.slice(0, 2).toUpperCase(),
  };
}

function template(sessions: string[], roles = COMPETICION_ROLES_AEP2): RosterSession[] {
  return sessions.map((sesion) => ({
    sesion,
    nombre: `Sesión ${sesion.slice(1)}`,
    dia: "Domingo",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "10:00 - 13:45",
    horarioPesaje: "08:00 - 09:30",
    roles: cloneRosterRoles(roles),
    pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  }));
}

const read = (name: string) => readFileSync(join(FIXTURES_DIR, name), "utf8");

describe("corpus de cuadrantes reales", () => {
  it("carga el corpus completo de la temporada", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(25);
  });

  it("nunca lanza y siempre devuelve una estructura válida para cada cuadrante", () => {
    for (const name of fixtures) {
      const text = read(name);
      const parsed = parseQuadrantAssignments(text, [], template(["S1", "S2", "S3"]));
      expect(Array.isArray(parsed.candidates), name).toBe(true);
      expect(Array.isArray(parsed.warnings), name).toBe(true);
    }
  });

  it("detecta los PDF imagen (sin capa de texto) y avisa en lugar de fallar en silencio", () => {
    const empties = fixtures.filter((name) => read(name).trim().length < 50);
    // Los dos cuadrantes AEP1/AEP2 "DEF" están escaneados como imagen.
    expect(empties.length).toBeGreaterThanOrEqual(2);
    for (const name of empties) {
      const parsed = parseQuadrantAssignments(read(name), [], template(["S1"]));
      expect(parsed.candidates, name).toEqual([]);
      expect(parsed.warnings.join(" "), name).toMatch(/imagen escaneada|sin texto/i);
    }
  });
});

describe("emparejamiento real — Hirugorri AEP-3 (22 feb 2026)", () => {
  // Censo tomado del propio cuadrante (8 jueces).
  const NAMES = [
    "Carmen Arenal Fernández",
    "Ainhoa Maniega Espinosa",
    "Jone Maguregi Rodriguez",
    "June Valeria Ibañez Cacho",
    "Diego Román Garatea",
    "Luisa Fernanda Ospina Buitrago",
    "Mario Liaño Gutierrez",
    "Denise Ninotchka Basilio Ambatali",
  ];
  const referees = NAMES.map(referee);
  const parsed = parseQuadrantAssignments(
    read("20260222_AEP3_Hirugorri.txt"),
    referees,
    template(["S1", "S2", "S3"]),
  );

  it("no genera avisos y empareja a los 8 jueces", () => {
    expect(parsed.warnings).toEqual([]);
    const matched = new Set(parsed.candidates.map((c) => c.refereeName));
    expect(matched.size).toBe(8);
  });

  it("mapea el bloque de competición al orden real AEP (central→lateral→…) por sesión", () => {
    const at = (session: string, roleKey: string) =>
      parsed.candidates.find(
        (c) => c.session === session && c.roleKey === roleKey && c.slotKey?.includes(`_${roleKey}_0`),
      )?.refereeName;
    // Fila central: S1 Carmen · S2 Mario · S3 Denise
    expect(at("S1", "central")).toBe("Carmen Arenal Fernández");
    expect(at("S2", "central")).toBe("Mario Liaño Gutierrez");
    expect(at("S3", "central")).toBe("Denise Ninotchka Basilio Ambatali");
  });

  it("detecta el bloque de pesaje y control de equipamiento", () => {
    const pesaje = parsed.candidates.filter((c) => c.roleKey === "pesaje");
    const equip = parsed.candidates.filter((c) => c.roleKey === "equipamiento");
    expect(pesaje.length).toBeGreaterThan(0);
    expect(equip.length).toBeGreaterThan(0);
  });
});
