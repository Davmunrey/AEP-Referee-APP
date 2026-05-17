import { revalidatePath } from "next/cache";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const event = await dataService.getCompetition(id);
  if (!event) return jsonError("Competición no encontrada", 404);
  return jsonOk(event);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }

  const event = await dataService.getCompetition(id);
  if (!event) return jsonError("Competición no encontrada", 404);

  // Un delegado de zona solo puede editar competiciones de SU zona
  // y no puede reasignar la competición a otra zona.
  if (user.role === "delegado_zona") {
    if (event.zona !== user.zona) return jsonError("Sin permiso", 403);
    if (body.zona !== undefined && body.zona !== user.zona) {
      return jsonError("No puedes mover competiciones a otra zona", 403);
    }
  }

  const updated = await dataService.updateCompetition(id, body);
  if (!updated) return jsonError("Competición no encontrada", 404);
  return jsonOk(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const event = await dataService.getCompetition(id);
  if (!event) return jsonError("Competición no encontrada", 404);
  if (user.role === "delegado_zona" && event.zona !== user.zona)
    return jsonError("Sin permiso", 403);

  const ok = await dataService.deleteCompetition(id);
  if (!ok) return jsonError("No se pudo eliminar el campeonato en la base de datos", 500);
  revalidatePath("/events");
  revalidatePath("/");
  revalidatePath(`/events/${id}`);
  return jsonOk({ deleted: true });
}
