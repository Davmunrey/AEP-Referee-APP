import { describe, expect, it } from "vitest";
import { COMPETICION_ROLES_AEP1, PESAJE_ROLES, cloneRosterRoles } from "@/lib/mock-data";
import { generateQuadrantHtml } from "@/lib/quadrant-html";
import type { AssignmentsMap, Competition, FlagsMap, RosterSession } from "@/lib/types";

const comp: Competition = {
  id: "c1",
  nombre: "II Campeonato Intend Power",
  tipo: "AEP-2",
  fecha: "2026-02-28",
  fechaFin: "2026-03-01",
  sede: "Venturada, Madrid",
  sesiones: 2,
  requeridos: 6,
  confirmados: 6,
  estado: "Completo",
  aprobacion: "pendiente",
};

function session(sesion: string): RosterSession {
  return {
    sesion,
    nombre: `Sesión ${sesion.slice(1)}`,
    dia: "Sábado 28 feb",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "10:00 - 13:30",
    horarioPesaje: "08:00 - 09:30",
    roles: cloneRosterRoles(COMPETICION_ROLES_AEP1),
    pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  };
}

const refs: Record<string, { nombre: string; nivel: string }> = {
  r1: { nombre: "Ana Vázquez", nivel: "IPF Cat. 1" },
  r2: { nombre: "Isa García", nivel: "Nacional" },
};

describe("generateQuadrantHtml", () => {
  const template = [session("S1"), session("S2")];
  const assignments: AssignmentsMap = {
    S1_central_0: "r1",
    S1_lateral_0: "r2",
    // S1_lateral_1 left empty on purpose
  };
  const flags: FlagsMap = {};
  const html = generateQuadrantHtml(comp, template, assignments, (id) => refs[id], flags);

  it("incluye cabecera AEP con logo, competición, tipo, sede y fechas", () => {
    expect(html).toContain("ASOCIACIÓN ESPAÑOLA de POWERLIFTING");
    expect(html).toContain("aep-mark.png");
    expect(html).toContain("II Campeonato Intend Power");
    expect(html).toContain("AEP-2");
    expect(html).toContain("Venturada, Madrid");
    expect(html).toContain("2026-02-28");
  });

  it("muestra nombres asignados sin nivel en las casillas", () => {
    expect(html).toContain("Ana Vázquez");
    expect(html).toContain("Isa García");
    expect(html).not.toContain("IPF Cat. 1"); // cuadrante = solo nombres
  });

  it("deja las casillas sin asignar en blanco (no aparece — VACÍO ni placeholder)", () => {
    expect(html).not.toContain("VACÍO");
    expect(html).not.toContain("undefined");
    // celda vacía = <td class="cell-name"></td>
    expect(html).toContain('<td class="cell-name"></td>');
  });

  it("oculta filas de rol vacías en todas las sesiones (jurado sin asignar)", () => {
    // template AEP1 tiene jurado pero el fixture no asigna ninguno -> fila no debe aparecer
    expect(html).not.toContain("Jurado 1");
  });

  it("incluye sección de pesaje solo si hay asignación", () => {
    // fixture tiene pesaje sin asignar -> sección omitida
    expect(html).not.toContain("PESAJE Y CONTROL DE EQUIPAMIENTO");
  });

  it("agrupa por día y rotula las sesiones (SESIÓN N)", () => {
    expect(html).toContain("Sábado 28 feb");
    expect(html).toContain("SESIÓN 1");
    expect(html).toContain("SESIÓN 2");
  });

  it("colorea filas por rol como el cuadrante oficial AEP", () => {
    expect(html).toContain("#FF0000"); // CENTRAL rojo
    expect(html).toContain("#FFFF00"); // LATERAL amarillo
    expect(html).toContain("leg-chip"); // leyenda de colores presente
    expect(html).toContain("Compartiendo funciones"); // nota *
    expect(html).toContain("Intercambio de funciones"); // nota ↑↓
  });

  it("formato vertical A4 (portrait) como el original", () => {
    expect(html).toContain("window.print()");
    expect(html).toContain("A4 portrait");
  });

  it("fuerza impresión de colores de fondo (print-color-adjust)", () => {
    // sin esto el navegador descarta los colores de rol al guardar PDF
    expect(html).toContain("print-color-adjust: exact");
  });

  it("autoPrint inyecta apertura automática del diálogo de impresión", () => {
    const auto = generateQuadrantHtml(comp, template, assignments, (id) => refs[id], flags, true);
    expect(auto).toContain('addEventListener("load"');
    // sin autoPrint no se auto-imprime (solo el botón manual)
    expect(html).not.toContain('addEventListener("load"');
  });

  it("plantilla vacía -> nota en vez de doc en blanco", () => {
    const empty = generateQuadrantHtml(comp, [], {}, () => undefined, {});
    expect(empty).toContain("Sin plantilla de tarima");
    expect(empty).toContain(comp.nombre); // cabecera sigue presente
  });
});
