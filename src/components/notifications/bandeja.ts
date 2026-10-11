import type { BandejaNotificaciones } from "@/lib/notificaciones";

/**
 * Bandeja tras marcar `ids` como leídos: estampa `leidaAt` y descuenta del
 * globo solo los que seguían sin leer (si otro refresco ya trajo la bandeja
 * del servidor con ellos leídos, no se restan dos veces).
 */
export function marcarLeidas(b: BandejaNotificaciones, ids: string[], ahora: string): BandejaNotificaciones {
  const marcados = new Set(ids);
  const nuevos = b.items.filter((x) => marcados.has(x.id) && !x.leidaAt).length;
  if (nuevos === 0) return b;
  return {
    sinLeer: Math.max(0, b.sinLeer - nuevos),
    items: b.items.map((x) => (marcados.has(x.id) && !x.leidaAt ? { ...x, leidaAt: ahora } : x)),
  };
}
