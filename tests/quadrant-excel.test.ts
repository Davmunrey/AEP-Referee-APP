import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { COMPETICION_ROLES_AEP1, PESAJE_ROLES, cloneRosterRoles } from "@/lib/mock-data";
import { generateQuadrantExcel } from "@/lib/quadrant-excel";
import type { AssignmentsMap, Competition, RosterSession } from "@/lib/types";

const comp: Competition = {
  id: "c1", nombre: "II Campeonato Intend Power", tipo: "AEP-2",
  fecha: "2026-02-28", fechaFin: "2026-03-01", sede: "Venturada, Madrid",
  sesiones: 1, requeridos: 6, confirmados: 6, estado: "Completo", aprobacion: "pendiente",
};

function session(sesion: string): RosterSession {
  return {
    sesion, nombre: `Sesión ${sesion.slice(1)}`, dia: "Sábado 28 feb",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "10:00 - 13:30", horarioPesaje: "08:00 - 09:30",
    roles: cloneRosterRoles(COMPETICION_ROLES_AEP1), pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  };
}

const refs: Record<string, { nombre: string; nivel: string }> = {
  r1: { nombre: "Ana Vázquez", nivel: "IPF Cat. 1" },
  r2: { nombre: "Isa García", nivel: "Nacional" },
};

describe("generateQuadrantExcel", () => {
  const assignments: AssignmentsMap = { S1_central_0: "r1", S1_lateral_0: "r2" };
  const buf = generateQuadrantExcel(comp, [session("S1")], assignments, (id) => refs[id], {});
  const wb = XLSX.read(buf, { type: "buffer" });

  it("devuelve un buffer xlsx no vacío", () => {
    expect(buf.length).toBeGreaterThan(0);
  });

  it("crea una hoja por día con los nombres asignados", () => {
    expect(wb.SheetNames).toContain("Sábado 28 feb");
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Sábado 28 feb"]!);
    expect(csv).toContain("Ana Vázquez");
    expect(csv).toContain("Isa García");
    expect(csv).toContain("SESIÓN 1");
  });

  it("plantilla vacía -> hoja Cuadrante con aviso", () => {
    const empty = generateQuadrantExcel(comp, [], {}, () => undefined, {});
    const ewb = XLSX.read(empty, { type: "buffer" });
    expect(ewb.SheetNames).toContain("Cuadrante");
  });
});
