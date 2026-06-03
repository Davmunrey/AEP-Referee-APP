import { canApprove } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { notifyApprovalReviewed } from "@/server/notifications/notify";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canApprove(user)) return jsonError("Sin permiso para aprobar", 403);

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const approve = Boolean(body.approve);
  // Límite de longitud: el comentario se refleja en el cuerpo de la push APNs
  // (límite ~4 KB) y en la UI del remitente.
  const comment = body.comment ? String(body.comment).slice(0, 500) : undefined;

  const result = await dataService.reviewApproval(id, approve, user.nombre, user.id, comment);
  if (!result) return jsonError("Propuesta no encontrada", 404);
  // Best-effort: avisa al remitente del resultado (no-op sin APNs).
  if (result.submittedById) {
    await notifyApprovalReviewed(result.submittedById, result.competitionName, approve, comment);
  }
  return jsonOk(result);
}
