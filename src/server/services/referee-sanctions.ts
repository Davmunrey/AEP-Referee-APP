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
  const { data } = await supabase
    .from("profiles")
    .select("id, nombre, email, zona, activo, role")
    .eq("role", "delegado_zona")
    .eq("activo", true);
  return (data ?? [])
    .filter((p) => resolveZoneCode(String(p.zona)) === resolveZoneCode(zone))
    .map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre),
      email: String(p.email),
    }));
}

async function syncRefereeAfterSanctionChange(refereeId: string): Promise<void> {
  const supabase = db();
  const { data: active } = await supabase
    .from("referee_sanctions")
    .select("id")
    .eq("referee_id", refereeId)
    .eq("status", "activa")
    .gte("fecha_fin", todayIso())
    .order("fecha_fin", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active?.id) {
    await supabase
      .from("referees")
      .update({
        estado: "Sancionado",
        disp: false,
        active_sanction_id: active.id,
      })
      .eq("id", refereeId);
    return;
  }

  await supabase
    .from("referees")
    .update({
      estado: "Activo",
      disp: true,
      active_sanction_id: null,
    })
    .eq("id", refereeId)
    .eq("estado", "Sancionado");
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
  const { data: expired } = await supabase
    .from("referee_sanctions")
    .select("id, referee_id")
    .eq("status", "activa")
    .lt("fecha_fin", today);

  if (!expired?.length) return 0;

  const ids = expired.map((r) => r.id);
  await supabase
    .from("referee_sanctions")
    .update({ status: "cumplida", updated_at: new Date().toISOString() })
    .in("id", ids);

  const refereeIds = [...new Set(expired.map((r) => String(r.referee_id)))];
  await Promise.all(refereeIds.map((rid) => syncRefereeAfterSanctionChange(rid)));
  return expired.length;
}

export async function listRefereeSanctions(
  refereeId: string,
): Promise<RefereeSanction[]> {
  const supabase = db();
  const { data } = await supabase
    .from("referee_sanctions")
    .select("*")
    .eq("referee_id", refereeId)
    .order("created_at", { ascending: false });
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

  await syncRefereeAfterSanctionChange(input.refereeId);

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
  const { data } = await supabase
    .from("referee_sanctions")
    .select("*")
    .eq("status", "activa")
    .gte("fecha_fin", todayIso())
    .order("fecha_fin", { ascending: true });

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
