import { revalidatePath } from "next/cache";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);
  const groups = await dataService.findCompetitionDuplicates(user);
  return jsonOk({
    groupCount: groups.length,
    duplicateCount: groups.reduce((n, g) => n + g.events.length - 1, 0),
    groups: groups.map((g) => ({
      key: g.key,
      events: g.events.map((e) => ({
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
  if (user.role !== "super_admin" && user.role !== "delegado_jueces") {
    return jsonError("Solo Super Admin o Delegado de Jueces pueden limpiar duplicados", 403);
  }
  const result = await dataService.removeDuplicateCompetitions(user);
  revalidatePath("/competitions");
  revalidatePath("/");
  return jsonOk(result);
}
