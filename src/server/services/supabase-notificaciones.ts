import type { BandejaNotificaciones, Notificacion, NuevaNotificacion } from "@/lib/notificaciones";
import { db } from "./supabase-helpers";

type Row = Record<string, unknown>;

function mapNotificacion(r: Row): Notificacion {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    tipo: r.tipo as Notificacion["tipo"],
    titulo: String(r.titulo),
    cuerpo: r.cuerpo ? String(r.cuerpo) : undefined,
    href: r.href ? String(r.href) : undefined,
    clave: r.clave ? String(r.clave) : undefined,
    createdAt: String(r.created_at),
    leidaAt: r.leida_at ? String(r.leida_at) : undefined,
  };
}

/** Inserta avisos; uno con la misma `clave` para la misma persona no se repite. */
async function insertNotificaciones(items: NuevaNotificacion[]): Promise<void> {
  if (items.length === 0) return;
  const rows = items.map((n) => ({
    user_id: n.userId,
    tipo: n.tipo,
    titulo: n.titulo.slice(0, 200),
    cuerpo: n.cuerpo?.slice(0, 1000) ?? null,
    href: n.href ?? null,
    clave: n.clave ?? null,
  }));
  const conClave = rows.filter((r) => r.clave);
  const sinClave = rows.filter((r) => !r.clave);
  const supabase = db();
  if (conClave.length) {
    const { error } = await supabase
      .from("notificaciones")
      .upsert(conClave, { onConflict: "user_id,clave", ignoreDuplicates: true });
    if (error) throw new Error(`notificaciones: ${error.message}`);
  }
  if (sinClave.length) {
    const { error } = await supabase.from("notificaciones").insert(sinClave);
    if (error) throw new Error(`notificaciones: ${error.message}`);
  }
}

async function getBandeja(userId: string, limit = 20): Promise<BandejaNotificaciones> {
  const supabase = db();
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase.from("notificaciones").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("notificaciones").select("id", { count: "exact", head: true }).eq("user_id", userId).is("leida_at", null),
  ]);
  if (error) throw new Error(`notificaciones: ${error.message}`);
  if (countError) throw new Error(`notificaciones: ${countError.message}`);
  return { items: (data ?? []).map((r) => mapNotificacion(r as Row)), sinLeer: count ?? 0 };
}

/** Marca como leídas todas las del usuario (o solo las indicadas). */
async function marcarLeidas(userId: string, ids?: string[]): Promise<void> {
  let q = db().from("notificaciones").update({ leida_at: new Date().toISOString() }).eq("user_id", userId).is("leida_at", null);
  if (ids && ids.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw new Error(`notificaciones: ${error.message}`);
}

export const notificacionService = { insertNotificaciones, getBandeja, marcarLeidas };
