/**
 * A quién va cada aviso: cuentas ACTIVAS, por rol y zona. Solo lectura de
 * perfiles; no depende de quién esté mirando.
 */
import { resolveZoneCode } from "@/lib/aep-zones";
import { DOCS_CAPTURE_SESSION, isDocsCaptureMode } from "@/lib/auth/docs-capture";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isMemoryJudgeAccountActive } from "@/server/judge-memory";
import { getStore } from "@/server/store";

async function activos(ids: string[], role: string): Promise<string[]> {
  if (ids.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("id")
      .in("id", ids.slice(i, i + 200))
      .eq("role", role)
      .eq("activo", true);
    if (error) throw new Error(`profiles: ${error.message}`);
    out.push(...(data ?? []).map((r) => String(r.id)));
  }
  return out;
}

/** Cuentas de juez activas de las fichas indicadas. */
export async function cuentasDeJueces(refereeIds: string[]): Promise<string[]> {
  if (refereeIds.length === 0) return [];
  if (!isSupabaseConfigured()) {
    const ids = new Set(refereeIds);
    return getStore()
      .referees.filter((r) => ids.has(r.id) && r.userId && isMemoryJudgeAccountActive(r.userId))
      .map((r) => r.userId!);
  }
  const userIds: string[] = [];
  for (let i = 0; i < refereeIds.length; i += 200) {
    const { data, error } = await createAdminClient()
      .from("referees")
      .select("user_id")
      .in("id", refereeIds.slice(i, i + 200))
      .not("user_id", "is", null);
    if (error) throw new Error(`referees: ${error.message}`);
    userIds.push(...(data ?? []).map((r) => String(r.user_id)));
  }
  return activos(userIds, "juez");
}

/** Cuentas de juez activas de una zona. */
export async function cuentasDeJuecesDeZona(zona: string): Promise<string[]> {
  const code = resolveZoneCode(zona);
  if (!code) return [];
  if (!isSupabaseConfigured()) {
    return getStore()
      .referees.filter((r) => resolveZoneCode(r.zona) === code && r.userId && isMemoryJudgeAccountActive(r.userId))
      .map((r) => r.userId!);
  }
  const { data, error } = await createAdminClient()
    .from("referees")
    .select("user_id")
    .eq("zona", code)
    .not("user_id", "is", null);
  if (error) throw new Error(`referees: ${error.message}`);
  return activos((data ?? []).map((r) => String(r.user_id)), "juez");
}

/** Delegados de zona activos de esa zona. */
export async function delegadosDeZona(zona: string): Promise<string[]> {
  const code = resolveZoneCode(zona);
  if (!code || !isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("role", "delegado_zona")
    .eq("zona", code)
    .eq("activo", true);
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? []).map((r) => String(r.id));
}

/** Gestión nacional activa (super admin y delegados de jueces). */
export async function gestionNacional(): Promise<string[]> {
  if (!isSupabaseConfigured()) return isDocsCaptureMode() ? [DOCS_CAPTURE_SESSION.id] : [];
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .in("role", ["super_admin", "delegado_jueces"])
    .eq("activo", true);
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? []).map((r) => String(r.id));
}
