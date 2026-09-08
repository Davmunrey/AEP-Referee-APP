import { macroZoneName, normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import {
  buildSanctionMailto,
  daysUntil,
  isSanctionActive,
  resolveSanctionEndDate,
  todayIso,
  zoneLabel,
} from "@/lib/sanctions";
import type {
  RefereeSanction,
  SanctionAlert,
  SanctionDurationPreset,
  SessionUser,
  ZoneDelegate,
} from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSanction, sanctionToDbRow } from "@/server/db/sanction-mappers";
import { nextSeqId } from "@/server/store";

function db() {
  return createAdminClient();
}

async function findZoneDelegates(zona: string): Promise<ZoneDelegate[]> {
  const supabase = db();
  const zone = normalizeZoneInput(zona) ?? zona;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, email, zona, activo, role")
    .eq("role", "delegado_zona")
    .eq("activo", true);
  // La lista de delegados y el mailto se congelan en la fila de la sanción y
  // no se vuelven a calcular nunca: con un fallo de lectura la sanción quedaba
  // guardada para siempre sin nadie a quien avisar y con el botón «Notificar»
  // apuntando a la nada.
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? [])
    .filter((p) => resolveZoneCode(String(p.zona)) === resolveZoneCode(zone))
    .map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre),
      email: String(p.email),
    }));
}

async function markRefereeSanctioned(
  refereeId: string,
  sanctionId: string,
): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("referees")
    .update({
      estado: "Sancionado",
      disp: false,
      active_sanction_id: sanctionId,
    })
    .eq("id", refereeId);
  if (error) throw new Error(`referees: ${error.message}`);
}

async function releaseSanctionedReferee(refereeId: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("referees")
    .update({
      estado: "Activo",
      disp: true,
      active_sanction_id: null,
    })
    .eq("id", refereeId)
    .eq("estado", "Sancionado");
  if (error) throw new Error(`referees: ${error.message}`);
}

/**
 * Deja la ficha del juez acorde con las sanciones que le quedan vivas.
 *
 * `fallbackActiveSanctionId` es la sanción que el llamante acaba de crear: si
 * la lectura falla sabemos que hay al menos una activa aunque no podamos ver
 * cuál vence más tarde.
 */
async function syncRefereeAfterSanctionChange(
  refereeId: string,
  options?: { fallbackActiveSanctionId?: string },
): Promise<void> {
  const supabase = db();
  const { data: active, error } = await supabase
    .from("referee_sanctions")
    .select("id")
    .eq("referee_id", refereeId)
    .eq("status", "activa")
    .gte("fecha_fin", todayIso())
    .order("fecha_fin", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Un fallo de lectura no es «no le queda ninguna sanción»: por esa vía se
  // liberaba —estado Activo, disp true, sin sanción activa en la ficha— a un
  // juez todavía sancionado, y el PATCH de la ficha, que sí lo comprueba, ya
  // no tenía nada que impedir. El juez volvía a aparecer como designable.
  if (error) {
    if (options?.fallbackActiveSanctionId) {
      await markRefereeSanctioned(refereeId, options.fallbackActiveSanctionId);
      return;
    }
    throw new Error(`referee_sanctions: ${error.message}`);
  }

  if (active?.id) {
    await markRefereeSanctioned(refereeId, String(active.id));
    return;
  }

  await releaseSanctionedReferee(refereeId);
}

// El barrido de expiración corre como máximo una vez cada 5 min por instancia:
// se ejecutaba en CADA listado de jueces y cada dashboard (2 consultas extra por
// request en el caso común "nada que expirar"). La deriva máxima de 5 min es
// irrelevante para sanciones cuya granularidad es de días.
const EXPIRE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastExpireSweepAt = 0;

export async function expireStaleSanctions(options?: { force?: boolean }): Promise<number> {
  const now = Date.now();
  if (!options?.force && now - lastExpireSweepAt < EXPIRE_SWEEP_INTERVAL_MS) return 0;
  lastExpireSweepAt = now;

  const supabase = db();
  const today = todayIso();
  const { data: expired, error: readError } = await supabase
    .from("referee_sanctions")
    .select("id, referee_id")
    .eq("status", "activa")
    .lt("fecha_fin", today);

  // La marca de barrido se pone antes de trabajar para evitar estampidas, pero
  // si el barrido no llega a hacerse hay que soltarla: si no, un fallo puntual
  // dejaba a los jueces «Sancionado» cinco minutos más de lo debido en cada
  // reintento.
  if (readError) {
    lastExpireSweepAt = 0;
    return 0;
  }

  if (!expired?.length) return 0;

  const ids = expired.map((r) => r.id);
  const { error: updateError } = await supabase
    .from("referee_sanctions")
    .update({ status: "cumplida", updated_at: new Date().toISOString() })
    .in("id", ids);
  // Sin esto se sincronizaban los jueces a «Activo» con las sanciones todavía
  // activas en la base de datos, y el siguiente barrido volvía a darles la
  // vuelta.
  if (updateError) {
    lastExpireSweepAt = 0;
    return 0;
  }

  const refereeIds = [...new Set(expired.map((r) => String(r.referee_id)))];
  // El barrido corre dentro del listado de jueces y del dashboard: si la ficha
  // de uno no se puede sincronizar, no se tumba la pantalla entera. Lo que sí
  // se hace es soltar la marca para que el siguiente listado vuelva a
  // intentarlo en vez de esperar cinco minutos.
  const synced = await Promise.allSettled(
    refereeIds.map((rid) => syncRefereeAfterSanctionChange(rid)),
  );
  if (synced.some((r) => r.status === "rejected")) {
    lastExpireSweepAt = 0;
  }
  return expired.length;
}

export async function listRefereeSanctions(
  refereeId: string,
): Promise<RefereeSanction[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("referee_sanctions")
    .select("*")
    .eq("referee_id", refereeId)
    .order("created_at", { ascending: false });
  // Una lista vacía por error de lectura presenta como limpio a un juez
  // sancionado: es justo la información por la que se consulta.
  if (error) throw new Error(`referee_sanctions: ${error.message}`);
  return (data ?? []).map((r) => mapSanction(r as Record<string, unknown>));
}

export async function getActiveSanction(
  refereeId: string,
): Promise<RefereeSanction | undefined> {
  const list = await listRefereeSanctions(refereeId);
  return list.find((s) => isSanctionActive(s));
}

export async function getRefereeSanction(
  sanctionId: string,
): Promise<RefereeSanction | undefined> {
  const supabase = db();
  const { data } = await supabase
    .from("referee_sanctions")
    .select("*")
    .eq("id", sanctionId)
    .maybeSingle();
  return data ? mapSanction(data as Record<string, unknown>) : undefined;
}

export async function createRefereeSanction(input: {
  refereeId: string;
  refereeName: string;
  zona: string;
  motivo: string;
  fechaInicio: string;
  duration: SanctionDurationPreset;
  fechaFinCustom?: string;
  notas?: string;
  impuestaPor: SessionUser;
}): Promise<RefereeSanction> {
  const supabase = db();
  const fechaFin = resolveSanctionEndDate(
    input.fechaInicio,
    input.duration,
    input.fechaFinCustom,
  );
  const zona = normalizeZoneInput(input.zona) ?? input.zona;
  const delegates = await findZoneDelegates(zona);
  const id = nextSeqId("san");

  const draft: RefereeSanction = {
    id,
    refereeId: input.refereeId,
    refereeName: input.refereeName,
    zona,
    motivo: input.motivo.trim(),
    fechaInicio: input.fechaInicio,
    fechaFin,
    status: "activa",
    impuestaPorId: input.impuestaPor.id,
    impuestaPorNombre: input.impuestaPor.nombre,
    notas: input.notas?.trim() || undefined,
    delegateNotify: {
      delegates,
      mailtoUrl: "",
    },
  };
  draft.delegateNotify.mailtoUrl = buildSanctionMailto(delegates, draft);

  const row = {
    id,
    ...sanctionToDbRow(draft),
    impuesta_por_id: input.impuestaPor.id,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("referee_sanctions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;

  // La sanción ya está guardada: si la ficha del juez no llega a marcarse,
  // queda designable con una sanción viva encima. Se avisa en claro en vez de
  // devolver un alta aparentemente correcta.
  try {
    await syncRefereeAfterSanctionChange(input.refereeId, {
      fallbackActiveSanctionId: id,
    });
  } catch (syncError) {
    const detail = syncError instanceof Error ? syncError.message : String(syncError);
    throw new Error(
      `La sanción se guardó, pero no se pudo marcar al juez como sancionado (${detail}). Revisa su ficha antes de designarlo.`,
    );
  }

  await supabase.from("activity_log").insert({
    tipo: "cambio",
    actor: input.impuestaPor.nombre,
    accion: `sancionó a ${input.refereeName} hasta ${fechaFin}`,
    evento: zoneLabel(zona),
    hace: "ahora",
  });

  return mapSanction(data as Record<string, unknown>);
}

export async function revokeRefereeSanction(
  sanctionId: string,
  actor: SessionUser,
  motivoRevocacion?: string,
): Promise<RefereeSanction | undefined> {
  const supabase = db();
  const { data: existing } = await supabase
    .from("referee_sanctions")
    .select("*")
    .eq("id", sanctionId)
    .maybeSingle();
  if (!existing) return undefined;

  // Revocar dos veces no vuelve a apilar la nota de revocación: el reintento
  // tras un fallo al sincronizar la ficha es la vía normal de recuperación.
  if (String(existing.status) === "revocada") {
    await syncRefereeAfterSanctionChange(String(existing.referee_id));
    return mapSanction(existing as Record<string, unknown>);
  }

  const now = new Date().toISOString();
  const patch = sanctionToDbRow({
    status: "revocada",
    revocadaPorNombre: actor.nombre,
    revocadaAt: now,
    notas: motivoRevocacion?.trim()
      ? `${String(existing.notas ?? "").trim()}\nRevocación: ${motivoRevocacion}`.trim()
      : String(existing.notas ?? "") || undefined,
  });

  const { data, error } = await supabase
    .from("referee_sanctions")
    .update(patch)
    .eq("id", sanctionId)
    .select()
    .single();
  if (error || !data) return undefined;

  await syncRefereeAfterSanctionChange(String(existing.referee_id));

  await supabase.from("activity_log").insert({
    tipo: "cambio",
    actor: actor.nombre,
    accion: `revocó sanción de ${existing.referee_name}`,
    evento: zoneLabel(String(existing.zona)),
    hace: "ahora",
  });

  return mapSanction(data as Record<string, unknown>);
}

export async function markSanctionDelegateNotified(
  sanctionId: string,
): Promise<RefereeSanction | undefined> {
  const supabase = db();
  const { data: existing } = await supabase
    .from("referee_sanctions")
    .select("*")
    .eq("id", sanctionId)
    .maybeSingle();
  if (!existing) return undefined;

  const current = mapSanction(existing as Record<string, unknown>);
  const delegateNotify = {
    ...current.delegateNotify,
    notifiedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("referee_sanctions")
    .update(sanctionToDbRow({ delegateNotify }))
    .eq("id", sanctionId)
    .select()
    .single();
  if (error || !data) return undefined;
  return mapSanction(data as Record<string, unknown>);
}

export async function getSanctionAlerts(
  user?: SessionUser,
  options?: { skipExpire?: boolean },
): Promise<SanctionAlert[]> {
  if (!options?.skipExpire) {
    await expireStaleSanctions();
  }
  const supabase = db();
  const { data, error } = await supabase
    .from("referee_sanctions")
    .select("*")
    .eq("status", "activa")
    .gte("fecha_fin", todayIso())
    .order("fecha_fin", { ascending: true });
  // Ídem: sin sanciones activas la aplicación da por bueno asignar a
  // cualquiera.
  if (error) throw new Error(`referee_sanctions: ${error.message}`);

  const userZone =
    user?.role === "delegado_zona" && user.zona
      ? resolveZoneCode(user.zona)
      : undefined;

  const alerts: SanctionAlert[] = [];
  for (const row of data ?? []) {
    const s = mapSanction(row as Record<string, unknown>);
    const z = resolveZoneCode(s.zona);
    if (userZone && z !== userZone) continue;

    const daysLeft = daysUntil(s.fechaFin);
    alerts.push({
      id: s.id,
      refereeId: s.refereeId,
      refereeName: s.refereeName,
      zona: s.zona,
      zonaName: macroZoneName(z ?? s.zona),
      fechaFin: s.fechaFin,
      daysLeft,
      kind: daysLeft <= 7 ? "por_vencer" : "activa",
    });
  }
  return alerts;
}
