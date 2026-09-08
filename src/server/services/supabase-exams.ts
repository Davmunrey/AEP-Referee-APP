import { normalizeZoneInput, resolveZoneCode, zonesMatch } from "@/lib/aep-zones";
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
import { db, fetchAllPagesOf, pushActivity } from "./supabase-helpers";
import { PromotionReviewError } from "@/lib/competitions/service-types";
import { isRefereeLevelUpgrade, refereeLevelRank } from "@/lib/referee-levels";

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
    // Paginado: la zona es texto libre y hay que canonicalizarla en memoria, así
    // que el corte de PostgREST en 1000 filas descartaría solicitudes antiguas
    // sin decir nada.
    const data = await fetchAllPagesOf<Record<string, unknown>>(
      "promotion_requests",
      (from, to) =>
        supabase.from("promotion_requests").select("*").order("id", { ascending: true }).range(from, to),
    );
    const list = data.map((r) => mapPromotion(r));
    // `zona` es texto libre (códigos legados pre-013 como "MAD"/"Centro"): un
    // `.eq` crudo ocultaba esas solicitudes al delegado; se canonicaliza como
    // en el twin en memoria.
    if (user?.role === "delegado_zona" && user.zona) {
      const userZone = resolveZoneCode(user.zona) ?? user.zona;
      return list.filter((p) => (resolveZoneCode(p.zona) ?? p.zona) === userZone);
    }
    return list;
  },

  reviewPromotion: async (id: string, approve: boolean, reviewer: string, comment?: string) => {
    const supabase = db();
    const { data: req } = await supabase.from("promotion_requests").select("*").eq("id", id).single();
    if (!req || req.status !== "pendiente") return undefined;

    // El nivel actual se lee ANTES de marcar la solicitud: si no se puede leer,
    // la solicitud sigue pendiente y se puede reintentar. Antes se leía después
    // y el error se traducía en `currentIdx = -1`, con lo que la comprobación
    // «solo si sigue siendo una subida» daba siempre verdadero: un ascenso a
    // Nacional aprobado tarde DEGRADABA a un juez que ya era IPF Cat. 1 — justo
    // lo que la comprobación existía para evitar.
    let currentNivel: string | null = null;
    if (approve) {
      const { data: ref, error: refError } = await supabase
        .from("referees")
        .select("nivel")
        .eq("id", req.referee_id)
        .maybeSingle();
      if (refError) throw new Error(`referees: ${refError.message}`);
      if (!ref) {
        throw new PromotionReviewError(
          "No se puede aprobar: el juez de la solicitud ya no existe en el censo.",
        );
      }
      currentNivel = String(ref.nivel);
      if (refereeLevelRank(currentNivel) < 0) {
        throw new PromotionReviewError(
          `No se puede aprobar: el nivel actual del juez (${currentNivel}) no es reconocible.`,
        );
      }
    }

    const status = approve ? "aprobado" : "rechazado";
    // Guard contra doble revisión concurrente: solo gana el primer revisor.
    const { data: claimed, error: claimError } = await supabase
      .from("promotion_requests")
      .update({ status, review_comment: comment ?? null })
      .eq("id", id)
      .eq("status", "pendiente")
      .select("id");
    // Un fallo de escritura también deja `claimed` vacío, y salía por la misma
    // puerta que la carrera perdida: al revisor se le decía «ya la revisó otro»
    // sobre una solicitud que sigue pendiente, así que ni la reintentaba.
    if (claimError) {
      console.error("[exams.reviewPromotion.claim]", id, claimError.message);
      throw new PromotionReviewError(
        "No se pudo registrar la revisión. La solicitud sigue pendiente; vuelve a intentarlo.",
      );
    }
    if (!claimed || claimed.length === 0) return undefined;
    if (approve && currentNivel) {
      if (isRefereeLevelUpgrade(currentNivel, req.to_level as string)) {
        // Compare-and-set sobre el nivel leído: si otro proceso lo cambió entre
        // medias, la escritura no toca nada en vez de pisar el nivel nuevo.
        // Pero eso hay que CONTARLO: la solicitud ya está en «aprobado» y no
        // vuelve a pendiente, así que un ascenso que no llegó a aplicarse se
        // quedaba aprobado sobre el papel y el juez con su nivel de siempre,
        // sin que nadie lo supiera.
        const { data: ascendido, error: nivelError } = await supabase
          .from("referees")
          .update({ nivel: req.to_level })
          .eq("id", req.referee_id)
          .eq("nivel", currentNivel)
          .select("id");
        if (nivelError) {
          console.error("[exams.reviewPromotion.nivel]", req.referee_id, nivelError.message);
          throw new PromotionReviewError(
            `El ascenso queda aprobado, pero el nivel del juez no llegó a cambiar a ${req.to_level}. Corrígelo en su ficha.`,
          );
        }
        if (!ascendido || ascendido.length === 0) {
          throw new PromotionReviewError(
            `El ascenso queda aprobado, pero el nivel del juez cambió mientras se revisaba y se ha dejado como está. Comprueba su ficha antes de darlo por hecho.`,
          );
        }
      }
    }
    await pushActivity({
      tipo: "ascenso",
      actor: reviewer,
      accion: approve ? "aprobó ascenso a" : "rechazó ascenso a",
      evento: req.to_level,
      hace: "ahora",
    });
    const { data, error: rereadError } = await supabase
      .from("promotion_requests")
      .select("*")
      .eq("id", id)
      .single();
    // La revisión ya está aplicada: devolver `undefined` la presentaba como
    // fallida y el revisor volvía a intentarlo.
    if (rereadError) {
      console.error("[exams.reviewPromotion.reread]", id, rereadError.message);
      throw new PromotionReviewError(
        "La revisión se guardó, pero no se pudo releer. Recarga la pantalla.",
      );
    }
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
    // `indexOf` sobre una copia local daba -1 para un nivel ilegible, y con
    // -1 cualquier destino contaba como ascenso.
    if (refereeLevelRank(referee.nivel as string) < 0) {
      throw new Error(`El nivel actual del juez (${referee.nivel}) no es reconocible.`);
    }
    if (!isRefereeLevelUpgrade(referee.nivel as string, input.toLevel)) {
      throw new Error(
        `El nivel destino (${input.toLevel}) debe ser superior al actual (${referee.nivel})`,
      );
    }
    const id = `pro-${crypto.randomUUID()}`;
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
    let query = supabase
      .from("referee_exams")
      .select("*")
      .order("fecha", { ascending: false })
      .order("id");
    if (refereeId) query = query.eq("referee_id", refereeId);
    if (user && user.role === "delegado_zona" && user.zona) {
      // La zona del perfil se canonicaliza: `referees.zona` guarda el código
      // canónico desde la 013, así que un perfil con un alias no casaba con
      // ningún juez y el delegado veía «no hay exámenes».
      const { data: zoneRefs, error: zoneError } = await supabase
        .from("referees")
        .select("id")
        .eq("zona", resolveZoneCode(user.zona) ?? user.zona);
      // Sin esto, un fallo de lectura dejaba la zona sin jueces y el delegado
      // veía «no hay exámenes» en vez de un error.
      if (zoneError) throw new Error(`referees: ${zoneError.message}`);
      const ids = (zoneRefs ?? []).map((r) => (r as { id: string }).id);
      if (ids.length === 0) return [];
      query = query.in("referee_id", ids);
    }
    // El historial de exámenes solo crece: sin paginar, PostgREST lo cortaba
    // en 1000 filas y los más antiguos desaparecían del expediente sin aviso.
    const data = await fetchAllPagesOf<Record<string, unknown>>("referee_exams", (from, to) =>
      query.range(from, to),
    );
    return data.map((r) => mapExam(r));
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
      id: `exam-${crypto.randomUUID()}`,
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
    // `.select("id")`: un DELETE que no casa filas no es error, así que se
    // devolvía true para un id inexistente (el twin en memoria devuelve false).
    const { data, error } = await supabase.from("referee_exams").delete().eq("id", id).select("id");
    return !error && (data?.length ?? 0) > 0;
  },

  getReport: async (id: string): Promise<RefereeReport | undefined> => {
    const supabase = db();
    const { data } = await supabase.from("referee_reports").select("*").eq("id", id).maybeSingle();
    return data ? mapReport(data as Record<string, unknown>) : undefined;
  },

  getReports: async (refereeId?: string, user?: SessionUser): Promise<RefereeReport[]> => {
    const supabase = db();
    // Ídem que en ascensos: el filtro por zona no puede ir en SQL, así que la
    // lectura se pagina para no perder informes por el corte de 1000 filas.
    const data = await fetchAllPagesOf<Record<string, unknown>>("referee_reports", (from, to) => {
      let query = supabase
        .from("referee_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (refereeId) query = query.eq("referee_id", refereeId);
      return query;
    });
    const list = data.map((r) => mapReport(r));
    // `referee_reports.zona` es texto libre: la migración 013 no normalizó esta
    // tabla, así que un `.eq` crudo escondía al delegado los informes guardados
    // con códigos anteriores («MAD», «Centro»). Mismo criterio que en ascensos,
    // propuestas y el twin en memoria.
    if (user?.role === "delegado_zona" && user.zona) {
      return list.filter((r) => zonesMatch(r.zona, user.zona));
    }
    return list;
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
      id: `rep-${crypto.randomUUID()}`,
      subject_type: input.subjectType,
      // Se guarda canónica: si el juez o la competición no tenían zona, se
      // caía en `input.zona` sin normalizar y la fila nacía ya ilegible para
      // el filtro por zona.
      zona: normalizeZoneInput(zona) ?? zona,
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
    // Cadena vacía = quitar el enlace: se guarda NULL en vez de "" para que la
    // columna no tenga dos formas de decir «sin adjunto».
    if (patch.adjuntoUrl !== undefined) dbPatch.adjunto_url = patch.adjuntoUrl || null;
    const { data, error } = await supabase.from("referee_reports").update(dbPatch).eq("id", id).select().single();
    if (error || !data) return undefined;
    return mapReport(data as Record<string, unknown>);
  },

  deleteReport: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { data, error } = await supabase.from("referee_reports").delete().eq("id", id).select("id");
    return !error && (data?.length ?? 0) > 0;
  },

  importJudgesRegistry: async (
    parsed: ParsedJudgesRegistry,
    options?: { replace?: boolean },
  ): Promise<JudgesRegistryImportApplyResult> => importJudgesRegistryToSupabase(parsed, options),
};
