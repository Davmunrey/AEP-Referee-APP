import { describe, it, expect } from "vitest";
import { computeJudgeProfile } from "@/lib/judge-stats";
import type { Referee, RefereeExam, RefereeReport } from "@/lib/types";

const REFEREE: Referee = {
  id: "r1",
  nombre: "Ana Ruiz",
  zona: "Centro",
  nivel: "Nacional",
  estado: "Activo",
  eventos: 12,
  ultimo: "2026-01-10",
  disp: true,
  iniciales: "AR",
};

function exam(over: Partial<RefereeExam> = {}): RefereeExam {
  return {
    id: "e1",
    refereeId: "r1",
    refereeName: "Ana Ruiz",
    tipo: "Teórico",
    nivelObjetivo: "Nacional",
    fecha: "2026-01-01",
    examinador: "Tribunal",
    puntuacion: 80,
    puntuacionMaxima: 100,
    resultado: "Aprobado",
    ...over,
  };
}

function report(over: Partial<RefereeReport> = {}): RefereeReport {
  return {
    id: "rep1",
    refereeId: "r1",
    refereeName: "Ana Ruiz",
    titulo: "Informe",
    tipo: "Desempeño",
    contenido: "...",
    autor: "Coordinador",
    ...over,
  };
}

describe("computeJudgeProfile", () => {
  it("handles a referee with no exams or reports", () => {
    const p = computeJudgeProfile(REFEREE, [], []);
    expect(p.examsTotal).toBe(0);
    expect(p.examsPassed).toBe(0);
    expect(p.avgScore).toBeNull();
    expect(p.lastExam).toBeUndefined();
    expect(p.exams).toEqual([]);
    expect(p.reports).toEqual([]);
    expect(p.referee).toBe(REFEREE);
  });

  it("counts passed exams via the 'Aprobado' result", () => {
    const exams = [
      exam({ id: "a", resultado: "Aprobado" }),
      exam({ id: "b", resultado: "Suspenso" }),
      exam({ id: "c", resultado: "Aprobado" }),
      exam({ id: "d", resultado: "Pendiente" }),
    ];
    const p = computeJudgeProfile(REFEREE, exams, []);
    expect(p.examsTotal).toBe(4);
    expect(p.examsPassed).toBe(2);
  });

  it("averages only exams that have a numeric score, rounded", () => {
    const exams = [
      exam({ id: "a", puntuacion: 90 }),
      exam({ id: "b", puntuacion: 81 }),
      exam({ id: "c", puntuacion: undefined }), // no score -> excluded
    ];
    const p = computeJudgeProfile(REFEREE, exams, []);
    // (90 + 81) / 2 = 85.5 -> rounds to 86
    expect(p.avgScore).toBe(86);
  });

  it("treats a zero score as a valid score (not missing)", () => {
    const exams = [exam({ id: "a", puntuacion: 0 }), exam({ id: "b", puntuacion: 100 })];
    const p = computeJudgeProfile(REFEREE, exams, []);
    expect(p.avgScore).toBe(50);
  });

  it("returns null average when no exam has a score", () => {
    const exams = [
      exam({ id: "a", puntuacion: undefined }),
      exam({ id: "b", puntuacion: undefined }),
    ];
    const p = computeJudgeProfile(REFEREE, exams, []);
    expect(p.avgScore).toBeNull();
    expect(p.examsTotal).toBe(2);
  });

  it("sorts exams by date descending and exposes the latest as lastExam", () => {
    const exams = [
      exam({ id: "old", fecha: "2025-03-01" }),
      exam({ id: "new", fecha: "2026-05-01" }),
      exam({ id: "mid", fecha: "2025-11-15" }),
    ];
    const p = computeJudgeProfile(REFEREE, exams, []);
    expect(p.exams.map((e) => e.id)).toEqual(["new", "mid", "old"]);
    expect(p.lastExam?.id).toBe("new");
  });

  it("sorts reports by createdAt descending", () => {
    const reports = [
      report({ id: "r-old", createdAt: "2025-01-01" }),
      report({ id: "r-new", createdAt: "2026-04-01" }),
    ];
    const p = computeJudgeProfile(REFEREE, [], reports);
    expect(p.reports.map((r) => r.id)).toEqual(["r-new", "r-old"]);
  });

  it("does not mutate the input arrays", () => {
    const exams = [exam({ id: "a", fecha: "2025-01-01" }), exam({ id: "b", fecha: "2026-01-01" })];
    const original = [...exams];
    computeJudgeProfile(REFEREE, exams, []);
    expect(exams).toEqual(original);
  });

  it("handles reports with missing createdAt without throwing", () => {
    const reports = [report({ id: "x" }), report({ id: "y", createdAt: "2026-01-01" })];
    const p = computeJudgeProfile(REFEREE, [], reports);
    // Report with a createdAt sorts ahead of the one without.
    expect(p.reports[0].id).toBe("y");
  });
});
