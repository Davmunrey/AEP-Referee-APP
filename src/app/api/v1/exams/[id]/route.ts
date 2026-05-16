import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ExamResult } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "lectura") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = (await request.json()) as {
    resultado?: ExamResult;
    puntuacion?: number;
    notas?: string;
    fecha?: string;
    examinador?: string;
  };
  const updated = await dataService.updateExam(id, body);
  if (!updated) return jsonError("Examen no encontrado", 404);
  return jsonOk(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role !== "nacional") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const ok = await dataService.deleteExam(id);
  if (!ok) return jsonError("Examen no encontrado", 404);
  return jsonOk({ deleted: true });
}
