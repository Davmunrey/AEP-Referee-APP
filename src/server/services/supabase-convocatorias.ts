/**
 * Convocatorias en Supabase: solo almacenamiento. Las reglas (quién puede
 * apuntarse, a qué, hasta cuándo) viven en `@/server/convocatorias`, igual
 * para los dos backends.
 */
import { resolveZoneCode } from "@/lib/aep-zones";
import type { Convocatoria, ConvocatoriaZona, DesignacionRespuesta, Inscripcion, ZonaPendiente } from "@/lib/convocatorias";
import { UserFacingServiceError } from "@/lib/competitions/service-types";
import { todayIso } from "@/lib/business-date";
import { db } from "./supabase-helpers";

type Row = Record<string, unknown>;

const CONV_COLS =
  "id, competition_id, estado, sesiones, cierra_el, mensaje, ampliar_dias_antes, ampliada_at, creada_por, creada_por_id, created_at";

function mapZona(r: Row): ConvocatoriaZona {
  return {
    zona: String(r.zona),
    estado: r.estado as ConvocatoriaZona["estado"],
    origen: r.origen as ConvocatoriaZona["origen"],
    solicitadaAt: r.solicitada_at ? String(r.solicitada_at) : undefined,
    resueltaPor: r.resuelta_por ? String(r.resuelta_por) : undefined,
    resueltaAt: r.resuelta_at ? String(r.resuelta_at) : undefined,
  };
}

function mapConvocatoria(r: Row, zonas: ConvocatoriaZona[]): Convocatoria {
  return {
    id: String(r.id),
    competitionId: String(r.competition_id),
    estado: r.estado as Convocatoria["estado"],
    sesiones: Array.isArray(r.sesiones) ? (r.sesiones as unknown[]).map(String) : [],
    cierraEl: String(r.cierra_el).slice(0, 10),
    mensaje: r.mensaje ? String(r.mensaje) : undefined,
    ampliarDiasAntes: r.ampliar_dias_antes == null ? undefined : Number(r.ampliar_dias_antes),
    ampliadaAt: r.ampliada_at ? String(r.ampliada_at) : undefined,
    creadaPor: r.creada_por ? String(r.creada_por) : undefined,
    creadaPorId: r.creada_por_id ? String(r.creada_por_id) : undefined,
    createdAt: r.created_at ? String(r.created_at) : undefined,
    zonas,
  };
}

function mapInscripcion(r: Row): Inscripcion {
  return {
    convocatoriaId: String(r.convocatoria_id),
    refereeId: String(r.referee_id),
    sesion: String(r.sesion),
    nota: r.nota ? String(r.nota) : undefined,
    createdAt: r.created_at ? String(r.created_at) : undefined,
  };
}

async function withZonas(rows: Row[]): Promise<Convocatoria[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const { data, error } = await db().from("convocatoria_zonas").select("*").in("convocatoria_id", ids);
  if (error) throw new Error(`convocatoria_zonas: ${error.message}`);
  const byConv = new Map<string, ConvocatoriaZona[]>();
  for (const z of data ?? []) {
    const id = String((z as Row).convocatoria_id);
    byConv.set(id, [...(byConv.get(id) ?? []), mapZona(z as Row)]);
  }
  return rows.map((r) => mapConvocatoria(r, byConv.get(String(r.id)) ?? []));
}

async function getConvocatoria(id: string): Promise<Convocatoria | null> {
  const { data, error } = await db().from("convocatorias").select(CONV_COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(`convocatorias: ${error.message}`);
  return data ? (await withZonas([data as Row]))[0]! : null;
}

/** La convocatoria viva (abierta o cerrada) de un campeonato. */
async function getLiveConvocatoria(competitionId: string): Promise<Convocatoria | null> {
  const { data, error } = await db()
    .from("convocatorias")
    .select(CONV_COLS)
    .eq("competition_id", competitionId)
    .neq("estado", "cancelada")
    .maybeSingle();
  if (error) throw new Error(`convocatorias: ${error.message}`);
  return data ? (await withZonas([data as Row]))[0]! : null;
}

/** Abiertas, sin cerrar todavía, y aceptadas para esta zona. */
async function listConvocatoriasAbiertasParaZona(zona: string, desde: string): Promise<Convocatoria[]> {
  const code = resolveZoneCode(zona);
  if (!code) return [];
  const supabase = db();
  const { data: zonas, error: zErr } = await supabase
    .from("convocatoria_zonas")
    .select("convocatoria_id")
    .eq("zona", code)
    .eq("estado", "aceptada");
  if (zErr) throw new Error(`convocatoria_zonas: ${zErr.message}`);
  const ids = [...new Set((zonas ?? []).map((z) => String((z as Row).convocatoria_id)))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("convocatorias")
    .select(CONV_COLS)
    .in("id", ids)
    .eq("estado", "abierta")
    .gte("cierra_el", desde)
    .order("cierra_el", { ascending: true });
  if (error) throw new Error(`convocatorias: ${error.message}`);
  return withZonas((data ?? []) as Row[]);
}

async function insertConvocatoria(input: Omit<Convocatoria, "id" | "createdAt">): Promise<Convocatoria> {
  const supabase = db();
  const { data, error } = await supabase
    .from("convocatorias")
    .insert({
      competition_id: input.competitionId,
      estado: input.estado,
      sesiones: input.sesiones,
      cierra_el: input.cierraEl,
      mensaje: input.mensaje ?? null,
      ampliar_dias_antes: input.ampliarDiasAntes ?? null,
      creada_por: input.creadaPor ?? null,
      creada_por_id: input.creadaPorId ?? null,
    })
    .select(CONV_COLS)
    .single();
  if (error?.code === "23505") {
    throw new UserFacingServiceError("Este campeonato ya tiene una convocatoria. Recarga la página para verla.");
  }
  if (error || !data) throw new Error(`convocatorias: ${error?.message ?? "sin fila"}`);
  const id = String((data as Row).id);
  if (input.zonas.length > 0) {
    const { error: zErr } = await supabase.from("convocatoria_zonas").insert(
      input.zonas.map((z) => ({
        convocatoria_id: id,
        zona: z.zona,
        estado: z.estado,
        origen: z.origen,
        resuelta_por: z.resueltaPor ?? null,
        resuelta_at: z.estado === "pendiente" ? null : new Date().toISOString(),
      })),
    );
    if (zErr) {
      // Sin zonas no la ve nadie: mejor no dejarla a medias.
      await supabase.from("convocatorias").delete().eq("id", id);
      throw new Error(`convocatoria_zonas: ${zErr.message}`);
    }
  }
  return (await getConvocatoria(id))!;
}

async function updateConvocatoria(
  id: string,
  patch: Partial<Pick<Convocatoria, "estado" | "cierraEl" | "mensaje" | "sesiones" | "ampliarDiasAntes">>,
): Promise<Convocatoria | null> {
  const row: Row = { updated_at: new Date().toISOString() };
  if (patch.estado !== undefined) row.estado = patch.estado;
  if (patch.cierraEl !== undefined) row.cierra_el = patch.cierraEl;
  if (patch.mensaje !== undefined) row.mensaje = patch.mensaje || null;
  if (patch.sesiones !== undefined) row.sesiones = patch.sesiones;
  if (patch.ampliarDiasAntes !== undefined) row.ampliar_dias_antes = patch.ampliarDiasAntes ?? null;
  const { data, error } = await db().from("convocatorias").update(row).eq("id", id).select("id");
  if (error?.code === "23505") {
    throw new UserFacingServiceError("Este campeonato ya tiene otra convocatoria viva.");
  }
  if (error) throw new Error(`convocatorias: ${error.message}`);
  if ((data ?? []).length === 0) return null;
  return getConvocatoria(id);
}

async function listInscripciones(convocatoriaId: string): Promise<Inscripcion[]> {
  const { data, error } = await db()
    .from("convocatoria_inscripciones")
    .select("*")
    .eq("convocatoria_id", convocatoriaId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`convocatoria_inscripciones: ${error.message}`);
  return (data ?? []).map((r) => mapInscripcion(r as Row));
}

async function listInscripcionesDeJuez(refereeId: string, convocatoriaIds: string[]): Promise<Inscripcion[]> {
  if (convocatoriaIds.length === 0) return [];
  const { data, error } = await db()
    .from("convocatoria_inscripciones")
    .select("*")
    .eq("referee_id", refereeId)
    .in("convocatoria_id", convocatoriaIds);
  if (error) throw new Error(`convocatoria_inscripciones: ${error.message}`);
  return (data ?? []).map((r) => mapInscripcion(r as Row));
}

/** Idempotente: apuntarse dos veces a la misma sesión no duplica nada. */
async function insertInscripcion(i: Inscripcion): Promise<void> {
  const { error } = await db()
    .from("convocatoria_inscripciones")
    .upsert(
      { convocatoria_id: i.convocatoriaId, referee_id: i.refereeId, sesion: i.sesion, nota: i.nota ?? null },
      { onConflict: "convocatoria_id,referee_id,sesion", ignoreDuplicates: true },
    );
  if (error) throw new Error(`convocatoria_inscripciones: ${error.message}`);
}

async function deleteInscripcion(convocatoriaId: string, refereeId: string, sesion: string): Promise<boolean> {
  const { data, error } = await db()
    .from("convocatoria_inscripciones")
    .delete()
    .eq("convocatoria_id", convocatoriaId)
    .eq("referee_id", refereeId)
    .eq("sesion", sesion)
    .select("sesion");
  if (error) throw new Error(`convocatoria_inscripciones: ${error.message}`);
  return (data ?? []).length > 0;
}


// ── Zonas convocadas ───────────────────────────────────────────────────────

/** Añade zonas; una que ya estaba no cambia (no se rebaja una aceptada). */
async function addConvocatoriaZonas(convocatoriaId: string, zonas: ConvocatoriaZona[]): Promise<void> {
  if (zonas.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await db()
    .from("convocatoria_zonas")
    .upsert(
      zonas.map((z) => ({
        convocatoria_id: convocatoriaId,
        zona: z.zona,
        estado: z.estado,
        origen: z.origen,
        resuelta_por: z.resueltaPor ?? null,
        resuelta_at: z.estado === "pendiente" ? null : now,
      })),
      { onConflict: "convocatoria_id,zona", ignoreDuplicates: true },
    );
  if (error) throw new Error(`convocatoria_zonas: ${error.message}`);
}

/**
 * Acepta o rechaza una zona pendiente. Condicional: si otro ya la resolvió,
 * no se pisa (devuelve `false`).
 */
async function resolverConvocatoriaZona(
  convocatoriaId: string,
  zona: string,
  estado: "aceptada" | "rechazada",
  resueltaPor: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from("convocatoria_zonas")
    .update({ estado, resuelta_por: resueltaPor, resuelta_at: new Date().toISOString() })
    .eq("convocatoria_id", convocatoriaId)
    .eq("zona", zona)
    .eq("estado", "pendiente")
    .select("zona");
  if (error) throw new Error(`convocatoria_zonas: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Peticiones pendientes de sumarse a convocatorias (de una zona, o todas). */
async function listZonasPendientes(zona?: string): Promise<ZonaPendiente[]> {
  let q = db().from("convocatoria_zonas").select("*").eq("estado", "pendiente");
  if (zona) q = q.eq("zona", zona);
  // Las más recientes primero: las pendientes de convocatorias ya cerradas no
  // se pueden responder y, en orden ascendente, tapaban a las nuevas.
  const { data, error } = await q.order("solicitada_at", { ascending: false }).limit(200);
  if (error) throw new Error(`convocatoria_zonas: ${error.message}`);
  return (data ?? []).map((r) => {
    const z = mapZona(r as Row);
    return { convocatoriaId: String((r as Row).convocatoria_id), zona: z.zona, origen: z.origen, solicitadaAt: z.solicitadaAt };
  });
}

/** Todas las abiertas que aún no han cerrado (para los recordatorios de cierre). */
async function listConvocatoriasAbiertas(desde: string): Promise<Convocatoria[]> {
  const { data, error } = await db()
    .from("convocatorias")
    .select(CONV_COLS)
    .eq("estado", "abierta")
    .gte("cierra_el", desde)
    .limit(500);
  if (error) throw new Error(`convocatorias: ${error.message}`);
  return withZonas((data ?? []) as Row[]);
}

/** Abiertas con ampliación automática configurada y aún sin ampliar. */
async function listConvocatoriasParaAmpliar(): Promise<Convocatoria[]> {
  const { data, error } = await db()
    .from("convocatorias")
    .select(CONV_COLS)
    .eq("estado", "abierta")
    .not("ampliar_dias_antes", "is", null)
    .is("ampliada_at", null)
    // Las de plazo vencido nunca se amplían: sin este filtro se acumulaban y,
    // con el `limit`, acababan dejando fuera a las vivas.
    .gte("cierra_el", todayIso())
    .order("cierra_el", { ascending: true })
    .limit(200);
  if (error) throw new Error(`convocatorias: ${error.message}`);
  return withZonas((data ?? []) as Row[]);
}

/** Marca la ampliación. Condicional: dos revisiones a la vez no amplían dos veces. */
async function marcarConvocatoriaAmpliada(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("convocatorias")
    .update({ ampliada_at: new Date().toISOString() })
    .eq("id", id)
    .is("ampliada_at", null)
    .select("id");
  if (error) throw new Error(`convocatorias: ${error.message}`);
  return (data ?? []).length > 0;
}

// ── Respuesta del juez a su designación ────────────────────────────────────

async function getDesignacionRespuestas(competitionId: string): Promise<Record<string, DesignacionRespuesta>> {
  const { data, error } = await db().from("designacion_respuestas").select("*").eq("competition_id", competitionId);
  if (error) throw new Error(`designacion_respuestas: ${error.message}`);
  const out: Record<string, DesignacionRespuesta> = {};
  for (const r of (data ?? []) as Row[]) {
    out[String(r.referee_id)] = {
      estado: r.estado as DesignacionRespuesta["estado"],
      motivo: r.motivo ? String(r.motivo) : undefined,
      updatedAt: r.updated_at ? String(r.updated_at) : undefined,
    };
  }
  return out;
}

async function getRespuestasDeJuez(refereeId: string): Promise<Record<string, DesignacionRespuesta>> {
  const { data, error } = await db().from("designacion_respuestas").select("*").eq("referee_id", refereeId);
  if (error) throw new Error(`designacion_respuestas: ${error.message}`);
  const out: Record<string, DesignacionRespuesta> = {};
  for (const r of (data ?? []) as Row[]) {
    out[String(r.competition_id)] = {
      estado: r.estado as DesignacionRespuesta["estado"],
      motivo: r.motivo ? String(r.motivo) : undefined,
      updatedAt: r.updated_at ? String(r.updated_at) : undefined,
    };
  }
  return out;
}

/** Al aprobarse de nuevo la tarima, las respuestas anteriores ya no valen. */
async function clearDesignacionRespuestas(competitionId: string): Promise<void> {
  const { error } = await db().from("designacion_respuestas").delete().eq("competition_id", competitionId);
  if (error) throw new Error(`designacion_respuestas: ${error.message}`);
}

async function setDesignacionRespuesta(
  competitionId: string,
  refereeId: string,
  respuesta: Omit<DesignacionRespuesta, "updatedAt">,
): Promise<void> {
  const { error } = await db().from("designacion_respuestas").upsert(
    {
      competition_id: competitionId,
      referee_id: refereeId,
      estado: respuesta.estado,
      motivo: respuesta.motivo ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "competition_id,referee_id" },
  );
  if (error) throw new Error(`designacion_respuestas: ${error.message}`);
}

export const convocatoriaService = {
  getConvocatoria,
  getLiveConvocatoria,
  listConvocatoriasAbiertasParaZona,
  insertConvocatoria,
  updateConvocatoria,
  listInscripciones,
  listInscripcionesDeJuez,
  insertInscripcion,
  deleteInscripcion,
  addConvocatoriaZonas,
  resolverConvocatoriaZona,
  listZonasPendientes,
  listConvocatoriasParaAmpliar,
  listConvocatoriasAbiertas,
  marcarConvocatoriaAmpliada,
  getDesignacionRespuestas,
  getRespuestasDeJuez,
  setDesignacionRespuesta,
  clearDesignacionRespuestas,
};
