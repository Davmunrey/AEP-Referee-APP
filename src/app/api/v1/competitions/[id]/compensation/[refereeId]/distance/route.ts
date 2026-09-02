import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string; refereeId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  const { id, refereeId } = await context.params;
  try {
    const claim = await dataService.calculateCompensationDistance(id, refereeId);
    if (!claim) return jsonError("Juez o campeonato no encontrado", 404);
    return jsonOk(claim);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // Solo los fallos de geocodificación/ruta (Nominatim/OSRM) son un 422 con
    // mensaje legible para el usuario. Un fallo de BD o de red interno era un
    // 422 que filtraba el texto interno; ahora es un 500 con mensaje genérico.
    if (/dirección|OpenStreetMap|coordenadas|ruta|Nominatim|OSRM/i.test(msg)) {
      return jsonError(msg, 422);
    }
    return jsonServerError("compensation.distance", err, "No se pudo calcular la ruta");
  }
}
