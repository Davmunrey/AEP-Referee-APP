import type { BandejaNotificaciones, NuevaNotificacion } from "@/lib/notificaciones";
import { getStore, nextSeqId } from "@/server/store";

function list() {
  const s = getStore();
  s.notificaciones ??= [];
  return s;
}

async function insertNotificaciones(items: NuevaNotificacion[]): Promise<void> {
  const s = list();
  for (const n of items) {
    if (n.clave && s.notificaciones.some((x) => x.userId === n.userId && x.clave === n.clave)) continue;
    s.notificaciones.push({ ...n, id: nextSeqId("ntf"), createdAt: new Date().toISOString() });
  }
}

async function getBandeja(userId: string, limit = 20): Promise<BandejaNotificaciones> {
  const mine = list().notificaciones.filter((n) => n.userId === userId);
  return {
    items: [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((n) => ({ ...n })),
    sinLeer: mine.filter((n) => !n.leidaAt).length,
  };
}

async function marcarLeidas(userId: string, ids?: string[]): Promise<void> {
  const now = new Date().toISOString();
  for (const n of list().notificaciones) {
    if (n.userId === userId && !n.leidaAt && (!ids?.length || ids.includes(n.id))) n.leidaAt = now;
  }
}

export const memoryNotificacionService = { insertNotificaciones, getBandeja, marcarLeidas };
