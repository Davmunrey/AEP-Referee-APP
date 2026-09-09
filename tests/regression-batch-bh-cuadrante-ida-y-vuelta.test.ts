import { describe, expect, it } from "vitest";
import { generateQuadrantHtml } from "@/lib/quadrant-html";
import { parseQuadrantAssignments } from "@/lib/quadrant-parser";
import { buildCompetitionSlotLayout } from "@/lib/roster-slot-layout";
import { enumerateSlotKeys, getPresetForEventType } from "@/lib/roster-template";
import type { Competition, Referee } from "@/lib/types";

const comp = {
  id: "c1",
  nombre: "Copa",
  tipo: "AEP-2",
  fecha: "2026-05-01",
  fechaFin: "2026-05-01",
  sede: "Madrid",
  sesiones: 1,
  requeridos: 7,
  confirmados: 7,
  estado: "Completo",
  aprobacion: "Aprobado",
  zona: "CENTRO",
} as Competition;

const referees: Referee[] = [
  "Ana Ruiz",
  "Beatriz Soler",
  "Carlos Vega",
  "Diego Mora",
  "Elena Pardo",
  "Fernando Gil",
  "Gloria Nieto",
].map(
  (nombre, i) =>
    ({
      id: `r${i}`,
      nombre,
      zona: "CENTRO",
      nivel: "Nacional",
      estado: "Activo",
      eventos: 0,
      ultimo: "",
      disp: true,
    }) as Referee,
);

function htmlATexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const template = () => getPresetForEventType("AEP-2").slice(0, 1);

function cuadranteImpreso() {
  const t = template();
  const huecos = enumerateSlotKeys(t).filter(
    (k) => !k.includes("pesaje") && !k.includes("equipamiento"),
  );
  const assignments: Record<string, string> = {};
  huecos.forEach((slot, i) => {
    assignments[slot] = referees[i]!.id;
  });
  const html = generateQuadrantHtml(comp, t, assignments, (id) => {
    const r = referees.find((x) => x.id === id);
    return r ? { nombre: r.nombre, nivel: r.nivel } : undefined;
  });
  return { assignments, texto: htmlATexto(html) };
}

describe("el cuadrante que imprime la app y el que sabe leer", () => {
  it("se imprimen en un orden y se leen en otro", () => {
    // El orden de lectura impreso sale de `buildCompetitionSlotLayout`; el
    // orden con el que el importador reparte los nombres es una tabla fija
    // calibrada con los PDF oficiales de la federación. No coinciden: la app
    // imprime CONTROL antes que SPEAKER y el importador espera lo contrario.
    const filas = buildCompetitionSlotLayout(template()[0]!.roles);
    const impreso = filas.flatMap((f) => f.cells.map((c) => c?.role.key ?? null)).filter(Boolean);
    expect(impreso).toEqual([
      "central",
      "lateral",
      "lateral",
      "ordenador",
      "control",
      "speaker",
      "speaker",
    ]);
  });

  it("un cuadrante con menos nombres que puestos avisa del desplazamiento", () => {
    // El caso de campo: un cuadrante oficial trae 6 nombres de competición y
    // la plantilla del campeonato tiene 7 puestos. La tabla posición → rol se
    // queda corta y a partir de ahí todo se desplaza; antes salía con
    // confianza «alta» y «Lista para asignar», sin un solo aviso.
    const { texto } = cuadranteImpreso();
    const seisNombres = texto.replace(/\s*Gloria Nieto\s*/, " ");
    const { warnings } = parseQuadrantAssignments(seisNombres, referees, template());
    expect(warnings.join(" ")).toMatch(/puede haberse desplazado/);
    expect(warnings.join(" ")).toMatch(/6 nombre\(s\) de competición/);
    expect(warnings.join(" ")).toMatch(/7 puesto\(s\)/);
  });

  it("cuando los números cuadran no se avisa de más", () => {
    const { texto } = cuadranteImpreso();
    const { warnings } = parseQuadrantAssignments(texto, referees, template());
    expect(warnings.join(" ")).not.toMatch(/puede haberse desplazado/);
  });

  it("y el desplazamiento es real: dos jueces cambian de puesto", () => {
    // Se fija el comportamiento de HOY, con el desajuste dentro, para que se
    // vea en el diff el día que se corrija: Fernando sale de speaker y vuelve
    // como control; Gloria sale de control y vuelve al bloque de pesaje.
    const { assignments, texto } = cuadranteImpreso();
    const { candidates } = parseQuadrantAssignments(texto, referees, template());
    const vuelta: Record<string, string> = {};
    for (const c of candidates) if (c.slotKey && c.refereeId) vuelta[c.slotKey] = c.refereeId;
    expect(vuelta).not.toEqual(assignments);
    expect(vuelta["S1_control_0"]).toBe("r5"); // Fernando, que era speaker
    expect(vuelta["S1_pesaje_0"]).toBe("r6"); // Gloria, que era control
    // Lo que sí se conserva: los cuatro primeros puestos.
    expect(vuelta["S1_central_0"]).toBe("r0");
    expect(vuelta["S1_lateral_0"]).toBe("r1");
    expect(vuelta["S1_lateral_1"]).toBe("r2");
    expect(vuelta["S1_ordenador_0"]).toBe("r3");
  });
});
