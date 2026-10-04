/**
 * Convocatorias en Supabase: solo almacenamiento. Las reglas (quién puede
 * apuntarse, a qué, hasta cuándo) viven en `@/server/convocatorias`, igual
 * para los dos backends.
 */
import { resolveZoneCode } from "@/lib/aep-zones";
import type { Convocatoria, ConvocatoriaZona, Inscripcion } from "@/lib/convocatorias";
import { UserFacingServiceError } from "@/lib/competitions/service-types";
import { db } from "./supabase-helpers";

type Row = Record<string, unknown>;

const CONV_COLS =
  "id, competition_id, estado, sesiones, cierra_el, mensaje, ampliar_dias_antes, ampliada_at, creada_por, created_at";

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

async function insertConvocatoria(input: Omit<Convocatoria, "id" | "createdAt"> & { creadaPorId?: string }): Promise<Convocatoria> {
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
};
