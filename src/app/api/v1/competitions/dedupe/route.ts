import { canDedupeCompetitions } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);
  let groups;
  try {
    groups = await dataService.findCompetitionDuplicates(user);
  } catch (err) {
    return jsonRouteError("competitions.dedupe.GET", err, "No se pudieron buscar duplicados");
  }
  return jsonOk({
    groupCount: groups.length,
    duplicateCount: groups.reduce((n, g) => n + g.competitions.length - 1, 0),
    groups: groups.map((g) => ({
      key: g.key,
      competitions: g.competitions.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        fecha: e.fecha,
        tipo: e.tipo,
        confirmados: e.confirmados,
        estado: e.estado,
      })),
    })),
  });
}

export async function POST() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);
  if (!canDedupeCompetitions(user.role)) {
    return jsonError("Solo Super Admin o Delegado de Jueces pueden limpiar duplicados", 403);
  }
  let result;
  try {
    result = await dataService.removeDuplicateCompetitions(user);
  } catch (err) {
    return jsonRouteError("competitions.dedupe.POST", err, "No se pudieron limpiar los duplicados");
  }
  revalidatePath("/competitions");
  revalidatePath("/");
  return jsonOk(result);
}
