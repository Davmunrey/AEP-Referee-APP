import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { COMPETICION_ROLES_AEP1, PESAJE_ROLES, cloneRosterRoles } from "@/lib/mock-data";
import { generateQuadrantExcel } from "@/lib/quadrant-excel";
import { generateQuadrantHtml } from "@/lib/quadrant-html";
import { formatCompetitionDatePhrase } from "@/lib/judge-compensation/receipt-document";
import { computeJudgeProfile } from "@/lib/judge-stats";
import { listActiveTarimaCompetitions } from "@/lib/roster-active";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import type { Competition, Referee, RefereeExam, RosterSession } from "@/lib/types";

const comp: Competition = {
  id: "c1",
  nombre: "II Campeonato Intend Power",
  tipo: "AEP-2",
  fecha: "2026-05-15",
  fechaFin: "2026-05-16",
  sede: "Venturada, Madrid",
  sesiones: 2,
  requeridos: 6,
  confirmados: 6,
  estado: "Completo",
  aprobacion: "pendiente",
};

function session(sesion: string, dia: string): RosterSession {
  return {
    sesion,
    nombre: sesion,
    dia,
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "10:00 - 13:30",
    horarioPesaje: "08:00 - 09:30",
    roles: cloneRosterRoles(COMPETICION_ROLES_AEP1),
    pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  };
}

const refLookup = (id: string) =>
  id === "r1" ? { nombre: "Ana Vázquez", nivel: "IPF Cat. 1" } : undefined;

// --- quadrant-excel: nombres de hoja únicos (antes lanzaba → HTTP 500) ------
describe("generateQuadrantExcel — colisión de nombre de hoja", () => {
  it("dos días que truncan al mismo nombre generan hojas distintas sin lanzar", () => {
    const template = [
      session("S1", "Viernes 15 de mayo de 2026 – mañana"),
      session("S2", "Viernes 15 de mayo de 2026 – tarde"),
    ];
    const buf = generateQuadrantExcel(comp, template, { S1_central_0: "r1" }, refLookup);
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toHaveLength(2);
    expect(new Set(wb.SheetNames.map((n) => n.toLowerCase())).size).toBe(2);
    for (const n of wb.SheetNames) expect(n.length).toBeLessThanOrEqual(31);
  });

  it("mismo día con distinta capitalización tampoco colisiona (Excel ignora mayúsculas)", () => {
    const template = [session("S1", "Viernes"), session("S2", "viernes")];
    expect(() => generateQuadrantExcel(comp, template, {}, refLookup)).not.toThrow();
  });
});

// --- cabecera de sesión: ids libres no se mutilan ---------------------------
describe("cabecera de sesión en cuadrante (ids no S<n>)", () => {
  it('"Sesión 3" → "SESIÓN 3" y un id libre se muestra tal cual', () => {
    const template = [session("Sesión 3", "Sábado"), session("Sábado tarde", "Sábado")];
    const html = generateQuadrantHtml(comp, template, { "Sesión 3_central_0": "r1" }, refLookup);
    expect(html).toContain("SESIÓN 3");
    expect(html).not.toContain("SESIÓN esión");
    expect(html).toContain("Sábado tarde");
    expect(html).not.toContain("SESIÓN ábado");
  });
});

// --- recibo: frase de fechas entre meses ------------------------------------
describe("formatCompetitionDatePhrase — rangos entre meses", () => {
  it("un rango de varios días entre meses usa «del … al …»", () => {
    expect(formatCompetitionDatePhrase("2026-04-29", "2026-05-02")).toBe(
      "del 29 de abril al 2 de mayo de 2026",
    );
  });
  it("dos días consecutivos entre meses siguen enumerándose con «y»", () => {
    expect(formatCompetitionDatePhrase("2026-04-30", "2026-05-01")).toBe(
      "los días 30 de abril y 1 de mayo de 2026",
    );
  });
});

// --- judge-stats: media normalizada a /100 ----------------------------------
describe("computeJudgeProfile — nota media normalizada", () => {
  const referee = {
    id: "j1",
    nombre: "Juez",
    zona: "CENTRO",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 0,
    ultimo: "—",
    disp: true,
    iniciales: "JJ",
  } as Referee;
  const exam = (id: string, puntuacion: number, puntuacionMaxima: number): RefereeExam =>
    ({
      id,
      refereeId: "j1",
      refereeName: "Juez",
      tipo: "Recertificación",
      nivelObjetivo: "Nacional",
      fecha: "2026-01-10",
      examinador: "Ex",
      puntuacion,
      puntuacionMaxima,
      resultado: "Aprobado",
      createdAt: "2026-01-10T00:00:00Z",
    }) as RefereeExam;

  it("18/20 y 90/100 promedian 90, no 54", () => {
    const p = computeJudgeProfile(referee, [exam("e1", 18, 20), exam("e2", 90, 100)], []);
    expect(p.avgScore).toBe(90);
  });
});

// --- roster-active: sin plazas requeridas al final --------------------------
describe("listActiveTarimaCompetitions — requeridos = 0", () => {
  const base = (partial: Partial<Competition> & Pick<Competition, "id" | "nombre">): Competition =>
    ({
      tipo: "AEP-1",
      fecha: "2099-06-01",
      fechaFin: "2099-06-02",
      sede: "Madrid",
      estado: "En curso",
      aprobacion: "Borrador",
      confirmados: 0,
      requeridos: 10,
      zona: "NOR",
      ...partial,
    }) as Competition;

  it("un campeonato sin plantilla (0/0) no encabeza la lista como «0 % cubierto»", () => {
    const list = listActiveTarimaCompetitions([
      base({ id: "sin", nombre: "Sin plantilla", confirmados: 0, requeridos: 0 }),
      base({ id: "b", nombre: "B", confirmados: 2, requeridos: 10 }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["b", "sin"]);
  });
});

// --- dashboard-intelligence: crítico ya celebrado no genera insight ---------
describe("buildIntelligence — críticos pasados", () => {
  it("un campeonato crítico ya celebrado no produce el aviso «asigna jueces»", () => {
    const now = new Date(2026, 8, 2);
    const { insights } = buildIntelligence(
      {
        referees: [],
        competitions: [],
        approvals: [],
        promotions: [],
        activity: [],
        coverage: [
          { id: "old", nombre: "Nacional 2024", fecha: "2024-05-01", estado: "Crítico", filled: 0, open: 8, required: 8 },
          { id: "next", nombre: "Regional", fecha: "2026-09-20", estado: "Crítico", filled: 0, open: 8, required: 8 },
        ],
      },
      now,
    );
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain("critical-old");
    expect(ids).toContain("critical-next");
  });
});
