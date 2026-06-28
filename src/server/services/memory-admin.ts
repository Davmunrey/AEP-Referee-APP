import { normalizeZoneInput } from "@/lib/aep-zones";
import { importJudgesRegistryToMemory } from "@/server/services/import-judges-registry";
import type { ParsedJudgesRegistry } from "@/lib/judges-registry";
import type {
  ExamResult,
  ExamType,
  JudgesRegistryImportApplyResult,
  PromotionRequest,
  RefereeExam,
  RefereeLevel,
  RefereeReport,
  RegulationRule,
  ReportType,
  SessionUser,
} from "@/lib/types";
import { REGULATION_RULES, getStore, pushActivity } from "@/server/store";

function validateExamLevel(tipo: ExamType, nivelObjetivo: RefereeLevel, nivelActual: RefereeLevel) {
  if (tipo === "Nuevo juez" && nivelObjetivo !== "Regional") throw new Error("Nuevo juez solo puede registrar nivel objetivo Regional");
  if (tipo === "Ascenso IPF" && !["IPF Cat. 2", "IPF Cat. 1"].includes(nivelObjetivo)) throw new Error("Ascenso IPF solo permite IPF Cat. 2 o IPF Cat. 1");
  if (tipo === "Recertificación" && nivelObjetivo !== nivelActual) throw new Error("Recertificación debe usar el nivel actual del juez");
}

export async function getPromotions(user?: SessionUser): Promise<PromotionRequest[]> {
  const list = getStore().promotions;
  if (user?.role === "delegado_zona" && user.zona) return list.filter((p) => p.zona === user.zona);
  return list;
}

export async function reviewPromotion(id: string, approve: boolean, reviewer: string): Promise<PromotionRequest | undefined> {
  const store = getStore();
  const req = store.promotions.find((p) => p.id === id);
  if (!req || req.status !== "pendiente") return undefined;
  req.status = approve ? "aprobado" : "rechazado";
  if (approve) {
    const ref = store.referees.find((r) => r.id === req.refereeId);
    // Solo sube el nivel si sigue siendo un ascenso frente al nivel ACTUAL.
    const LEVEL_ORDER = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];
    if (ref && LEVEL_ORDER.indexOf(req.toLevel) > LEVEL_ORDER.indexOf(ref.nivel)) {
      ref.nivel = req.toLevel;
    }
  }
  pushActivity({ tipo: "ascenso", actor: reviewer, accion: approve ? "aprobó ascenso a" : "rechazó ascenso a", evento: req.toLevel, hace: "ahora" });
  return req;
}

export async function createPromotion(input: {
  refereeId: string;
  toLevel: RefereeLevel;
  zona: string;
  motivo?: string;
}): Promise<PromotionRequest> {
  const store = getStore();
  const referee = store.referees.find((r) => r.id === input.refereeId);
  if (!referee) throw new Error("Juez no encontrado");
  const LEVEL_ORDER = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];
  if (LEVEL_ORDER.indexOf(input.toLevel) <= LEVEL_ORDER.indexOf(referee.nivel)) throw new Error(`El nivel destino (${input.toLevel}) debe ser superior al actual (${referee.nivel})`);
  const req: PromotionRequest = {
    id: `pro-${Date.now()}`, refereeId: input.refereeId, refereeName: referee.nombre,
    fromLevel: referee.nivel, toLevel: input.toLevel,
    zona: normalizeZoneInput(input.zona) ?? input.zona,
    status: "pendiente", submittedAt: new Date().toISOString().split("T")[0]!,
    eventosCompletados: referee.eventos, motivo: input.motivo,
  };
  store.promotions.unshift(req);
  return req;
}

export async function getRegulations(): Promise<RegulationRule[]> {
  return REGULATION_RULES;
}

export async function getCompetitionAvailability(_competitionId: string): Promise<string[]> { return []; }
export async function addCompetitionAvailability(_competitionId: string, _refereeId: string, _actor: string): Promise<void> {}
export async function removeCompetitionAvailability(_competitionId: string, _refereeId: string): Promise<void> {}

export async function getExams(refereeId?: string, user?: SessionUser): Promise<RefereeExam[]> {
  const store = getStore();
  let exams = store.exams.slice();
  if (user?.role === "delegado_zona" && user.zona) {
    const zoneRefs = new Set(store.referees.filter((r) => r.zona === user.zona).map((r) => r.id));
    exams = exams.filter((e) => zoneRefs.has(e.refereeId));
  }
  if (refereeId) exams = exams.filter((e) => e.refereeId === refereeId);
  return exams.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function createExam(input: {
  refereeId: string; tipo: ExamType; nivelObjetivo: RefereeLevel; fecha: string;
  examinador: string; puntuacion?: number; puntuacionMaxima?: number; resultado?: ExamResult; notas?: string;
}): Promise<RefereeExam> {
  const store = getStore();
  const referee = store.referees.find((r) => r.id === input.refereeId);
  if (!referee) throw new Error("Juez no encontrado");
  validateExamLevel(input.tipo, input.nivelObjetivo, referee.nivel);
  const exam: RefereeExam = {
    id: `exam-${Date.now()}`, refereeId: input.refereeId, refereeName: referee.nombre,
    tipo: input.tipo, nivelObjetivo: input.nivelObjetivo, fecha: input.fecha,
    examinador: input.examinador, puntuacion: input.puntuacion,
    puntuacionMaxima: input.puntuacionMaxima ?? 100,
    resultado: input.resultado ?? "Pendiente", notas: input.notas, createdAt: new Date().toISOString(),
  };
  store.exams.unshift(exam);
  return exam;
}

export async function updateExam(
  id: string,
  patch: Partial<Pick<RefereeExam, "resultado" | "puntuacion" | "notas" | "fecha" | "examinador">>,
): Promise<RefereeExam | undefined> {
  const exam = getStore().exams.find((e) => e.id === id);
  if (!exam) return undefined;
  Object.assign(exam, patch);
  return exam;
}

export async function deleteExam(id: string): Promise<boolean> {
  const store = getStore();
  const idx = store.exams.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  store.exams.splice(idx, 1);
  return true;
}

export async function getReport(id: string): Promise<RefereeReport | undefined> {
  return getStore().reports.find((r) => r.id === id);
}

export async function getReports(refereeId?: string, user?: SessionUser): Promise<RefereeReport[]> {
  const store = getStore();
  let reports = store.reports.slice();
  if (user?.role === "delegado_zona" && user.zona) reports = reports.filter((r) => r.zona === user.zona);
  if (refereeId) reports = reports.filter((r) => r.refereeId === refereeId);
  return reports.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function createReport(input: {
  subjectType: RefereeReport["subjectType"]; zona: string; refereeId?: string;
  competitionId?: string; titulo: string; tipo: ReportType; evento?: string;
  contenido: string; adjuntoUrl?: string; autor: string;
}): Promise<RefereeReport> {
  const store = getStore();
  const referee = input.refereeId ? store.referees.find((r) => r.id === input.refereeId) : undefined;
  const competition = input.competitionId ? store.competitions.find((c) => c.id === input.competitionId) : undefined;
  if (input.subjectType === "juez" && !referee) throw new Error("Juez no encontrado");
  if (input.subjectType === "competicion" && !competition) throw new Error("Competición no encontrada");
  const report: RefereeReport = {
    id: `rep-${Date.now()}`, subjectType: input.subjectType,
    zona: referee?.zona ?? competition?.zona ?? input.zona,
    refereeId: referee?.id, refereeName: referee?.nombre,
    competitionId: competition?.id, competitionName: competition?.nombre,
    titulo: input.titulo, tipo: input.tipo, evento: input.evento,
    contenido: input.contenido, adjuntoUrl: input.adjuntoUrl,
    autor: input.autor, createdAt: new Date().toISOString(),
  };
  store.reports.unshift(report);
  return report;
}

export async function updateReport(
  id: string,
  patch: Partial<Pick<RefereeReport, "titulo" | "tipo" | "evento" | "contenido" | "adjuntoUrl">>,
): Promise<RefereeReport | undefined> {
  const report = getStore().reports.find((r) => r.id === id);
  if (!report) return undefined;
  Object.assign(report, patch);
  return report;
}

export async function deleteReport(id: string): Promise<boolean> {
  const store = getStore();
  const idx = store.reports.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  store.reports.splice(idx, 1);
  return true;
}

export async function createRefereeSanction(): Promise<never> {
  throw new Error("Sanciones requieren Supabase configurado");
}
export async function revokeRefereeSanction(): Promise<never> {
  throw new Error("Sanciones requieren Supabase configurado");
}
export async function markSanctionDelegateNotified(): Promise<never> {
  throw new Error("Sanciones requieren Supabase configurado");
}
export async function getSanctionAlerts(): Promise<[]> { return []; }
export async function expireStaleSanctions(): Promise<number> { return 0; }

export async function importJudgesRegistry(
  parsed: ParsedJudgesRegistry,
  options?: { replace?: boolean },
): Promise<JudgesRegistryImportApplyResult> {
  return importJudgesRegistryToMemory(parsed, options);
}
