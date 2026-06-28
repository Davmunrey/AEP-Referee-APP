import { normalizeZoneInput } from "@/lib/aep-zones";
import { importJudgesRegistryToSupabase } from "@/server/services/import-judges-registry";
import type { ParsedJudgesRegistry } from "@/lib/judges-registry";
import type {
  ExamResult,
  ExamType,
  JudgesRegistryImportApplyResult,
  PromotionRequest,
  RefereeExam,
  RefereeLevel,
  RefereeReport,
  ReportType,
  SessionUser,
} from "@/lib/types";
import { mapExam, mapPromotion, mapReport } from "@/server/db/mappers";
import { db, pushActivity } from "./supabase-helpers";

function validateExamLevel(tipo: ExamType, nivelObjetivo: RefereeLevel, nivelActual: RefereeLevel) {
  if (tipo === "Nuevo juez" && nivelObjetivo !== "Regional") {
    throw new Error("Nuevo juez solo puede registrar nivel objetivo Regional");
  }
  if (tipo === "Ascenso IPF" && !["IPF Cat. 2", "IPF Cat. 1"].includes(nivelObjetivo)) {
    throw new Error("Ascenso IPF solo permite IPF Cat. 2 o IPF Cat. 1");
  }
  if (tipo === "Recertificación" && nivelObjetivo !== nivelActual) {
    throw new Error("Recertificación debe usar el nivel actual del juez");
  }
}

export const examsService = {
  getPromotions: async (user?: SessionUser): Promise<PromotionRequest[]> => {
    const supabase = db();
    let query = supabase.from("promotion_requests").select("*");
    if (user?.role === "delegado_zona" && user.zona) query = query.eq("zona", user.zona);
    const { data } = await query;
    return (data ?? []).map((r) => mapPromotion(r as Record<string, unknown>));
  },

  reviewPromotion: async (id: string, approve: boolean, reviewer: string) => {
    const supabase = db();
    const { data: req } = await supabase.from("promotion_requests").select("*").eq("id", id).single();
    if (!req || req.status !== "pendiente") return undefined;
    const status = approve ? "aprobado" : "rechazado";
    await supabase.from("promotion_requests").update({ status }).eq("id", id);
    if (approve) {
      // Solo aplica el ascenso si sigue siendo una subida frente al nivel ACTUAL
      // del juez (evita degradar si su nivel cambió tras crear la solicitud).
      const { data: ref } = await supabase
        .from("referees")
        .select("nivel")
        .eq("id", req.referee_id)
        .single();
      const LEVEL_ORDER = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];
      const currentIdx = ref ? LEVEL_ORDER.indexOf(ref.nivel as string) : -1;
      const toIdx = LEVEL_ORDER.indexOf(req.to_level as string);
      if (toIdx > currentIdx) {
        await supabase.from("referees").update({ nivel: req.to_level }).eq("id", req.referee_id);
      }
    }
    await pushActivity({
      tipo: "ascenso",
      actor: reviewer,
      accion: approve ? "aprobó ascenso a" : "rechazó ascenso a",
      evento: req.to_level,
      hace: "ahora",
    });
    const { data } = await supabase.from("promotion_requests").select("*").eq("id", id).single();
    return data ? mapPromotion(data as Record<string, unknown>) : undefined;
  },

  createPromotion: async (input: {
    refereeId: string;
    toLevel: RefereeLevel;
    zona: string;
    motivo?: string;
  }): Promise<PromotionRequest> => {
    const supabase = db();
    const { data: referee } = await supabase
      .from("referees")
      .select("nombre, nivel, eventos")
      .eq("id", input.refereeId)
      .single();
    if (!referee) throw new Error("Juez no encontrado");
    const LEVEL_ORDER = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];
    const fromIdx = LEVEL_ORDER.indexOf(referee.nivel as string);
    const toIdx = LEVEL_ORDER.indexOf(input.toLevel);
    if (toIdx <= fromIdx) throw new Error(`El nivel destino (${input.toLevel}) debe ser superior al actual (${referee.nivel})`);
    const id = `pro-${Date.now()}`;
    const row = {
      id,
      referee_id: input.refereeId,
      referee_name: referee.nombre,
      from_level: referee.nivel,
      to_level: input.toLevel,
      zona: normalizeZoneInput(input.zona) ?? input.zona,
      status: "pendiente",
      submitted_at: new Date().toISOString().split("T")[0],
      eventos_completados: referee.eventos,
      motivo: input.motivo ?? null,
    };
    const { data, error } = await supabase.from("promotion_requests").insert(row).select().single();
    if (error) throw error;
    return mapPromotion(data as Record<string, unknown>);
  },

  getExams: async (refereeId?: string, user?: SessionUser): Promise<RefereeExam[]> => {
    const supabase = db();
    let query = supabase.from("referee_exams").select("*").order("fecha", { ascending: false });
    if (refereeId) query = query.eq("referee_id", refereeId);
    if (user && user.role === "delegado_zona" && user.zona) {
      const { data: zoneRefs } = await supabase.from("referees").select("id").eq("zona", user.zona);
      const ids = (zoneRefs ?? []).map((r) => (r as { id: string }).id);
      if (ids.length === 0) return [];
      query = query.in("referee_id", ids);
    }
    const { data } = await query;
    return (data ?? []).map((r) => mapExam(r as Record<string, unknown>));
  },

  createExam: async (input: {
    refereeId: string;
    tipo: ExamType;
    nivelObjetivo: RefereeLevel;
    fecha: string;
    examinador: string;
    puntuacion?: number;
    puntuacionMaxima?: number;
    resultado?: ExamResult;
    notas?: string;
  }): Promise<RefereeExam> => {
    const supabase = db();
    const { data: ref } = await supabase.from("referees").select("nombre, nivel").eq("id", input.refereeId).single();
    if (!ref) throw new Error("Juez no encontrado");
    validateExamLevel(input.tipo, input.nivelObjetivo, ref.nivel as RefereeLevel);
    const row = {
      id: `exam-${Date.now()}`,
      referee_id: input.refereeId,
      referee_name: ref.nombre,
      tipo: input.tipo,
      nivel_objetivo: input.nivelObjetivo,
      fecha: input.fecha,
      examinador: input.examinador,
      puntuacion: input.puntuacion ?? null,
      puntuacion_maxima: input.puntuacionMaxima ?? 100,
      resultado: input.resultado ?? "Pendiente",
      notas: input.notas ?? null,
    };
    const { data, error } = await supabase.from("referee_exams").insert(row).select().single();
    if (error) throw error;
    await pushActivity({ tipo: "cambio", actor: input.examinador, accion: `registró examen ${input.tipo} de`, evento: ref.nombre, hace: "ahora" });
    return mapExam(data as Record<string, unknown>);
  },

  updateExam: async (
    id: string,
    patch: Partial<Pick<RefereeExam, "resultado" | "puntuacion" | "notas" | "fecha" | "examinador">>,
  ): Promise<RefereeExam | undefined> => {
    const supabase = db();
    const dbPatch: Record<string, unknown> = {};
    if (patch.resultado !== undefined) dbPatch.resultado = patch.resultado;
    if (patch.puntuacion !== undefined) dbPatch.puntuacion = patch.puntuacion;
    if (patch.notas !== undefined) dbPatch.notas = patch.notas;
    if (patch.fecha !== undefined) dbPatch.fecha = patch.fecha;
    if (patch.examinador !== undefined) dbPatch.examinador = patch.examinador;
    const { data, error } = await supabase.from("referee_exams").update(dbPatch).eq("id", id).select().single();
    if (error || !data) return undefined;
    return mapExam(data as Record<string, unknown>);
  },

  deleteExam: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase.from("referee_exams").delete().eq("id", id);
    return !error;
  },

  getReport: async (id: string): Promise<RefereeReport | undefined> => {
    const supabase = db();
    const { data } = await supabase.from("referee_reports").select("*").eq("id", id).maybeSingle();
    return data ? mapReport(data as Record<string, unknown>) : undefined;
  },

  getReports: async (refereeId?: string, user?: SessionUser): Promise<RefereeReport[]> => {
    const supabase = db();
    let query = supabase.from("referee_reports").select("*").order("created_at", { ascending: false });
    if (refereeId) query = query.eq("referee_id", refereeId);
    if (user && user.role === "delegado_zona" && user.zona) query = query.eq("zona", user.zona);
    const { data } = await query;
    return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
  },

  createReport: async (input: {
    subjectType: RefereeReport["subjectType"];
    zona: string;
    refereeId?: string;
    competitionId?: string;
    titulo: string;
    tipo: ReportType;
    evento?: string;
    contenido: string;
    adjuntoUrl?: string;
    autor: string;
  }): Promise<RefereeReport> => {
    const supabase = db();
    let refereeName: string | null = null;
    let competitionName: string | null = null;
    let zona = input.zona;
    if (input.subjectType === "juez") {
      if (!input.refereeId) throw new Error("Juez obligatorio");
      const { data: ref } = await supabase.from("referees").select("nombre, zona").eq("id", input.refereeId).single();
      if (!ref) throw new Error("Juez no encontrado");
      refereeName = String(ref.nombre);
      zona = String(ref.zona ?? zona);
    } else {
      if (!input.competitionId) throw new Error("Competición obligatoria");
      const { data: comp } = await supabase.from("competitions").select("nombre, zona").eq("id", input.competitionId).single();
      if (!comp) throw new Error("Competición no encontrada");
      competitionName = String(comp.nombre);
      zona = String(comp.zona ?? zona);
    }
    const row = {
      id: `rep-${Date.now()}`,
      subject_type: input.subjectType,
      zona,
      referee_id: input.refereeId ?? null,
      referee_name: refereeName,
      competition_id: input.competitionId ?? null,
      competition_name: competitionName,
      titulo: input.titulo,
      tipo: input.tipo,
      evento: input.evento ?? null,
      contenido: input.contenido,
      adjunto_url: input.adjuntoUrl ?? null,
      autor: input.autor,
    };
    const { data, error } = await supabase.from("referee_reports").insert(row).select().single();
    if (error) throw error;
    await pushActivity({ tipo: "cambio", actor: input.autor, accion: `subió informe «${input.titulo}» de`, evento: refereeName ?? competitionName ?? "competición", hace: "ahora" });
    return mapReport(data as Record<string, unknown>);
  },

  updateReport: async (
    id: string,
    patch: Partial<Pick<RefereeReport, "titulo" | "tipo" | "evento" | "contenido" | "adjuntoUrl">>,
  ): Promise<RefereeReport | undefined> => {
    const supabase = db();
    const dbPatch: Record<string, unknown> = {};
    if (patch.titulo !== undefined) dbPatch.titulo = patch.titulo;
    if (patch.tipo !== undefined) dbPatch.tipo = patch.tipo;
    if (patch.evento !== undefined) dbPatch.evento = patch.evento;
    if (patch.contenido !== undefined) dbPatch.contenido = patch.contenido;
    if (patch.adjuntoUrl !== undefined) dbPatch.adjunto_url = patch.adjuntoUrl;
    const { data, error } = await supabase.from("referee_reports").update(dbPatch).eq("id", id).select().single();
    if (error || !data) return undefined;
    return mapReport(data as Record<string, unknown>);
  },

  deleteReport: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase.from("referee_reports").delete().eq("id", id);
    return !error;
  },

  importJudgesRegistry: async (
    parsed: ParsedJudgesRegistry,
    options?: { replace?: boolean },
  ): Promise<JudgesRegistryImportApplyResult> => importJudgesRegistryToSupabase(parsed, options),
};
