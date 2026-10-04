import { canApprove } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { ApprovalReviewError } from "@/lib/competitions/service-types";
import { jsonError, jsonOk, jsonRouteError, readOrError } from "@/lib/api/route-utils";
import { afterResponse } from "@/lib/after-response";
import { dataService } from "@/server/services";
import { notificarDesignacion } from "@/server/convocatorias";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canApprove(user)) return jsonError("Sin permiso para aprobar", 403);

  const { id } = await context.params;
  // `null` es JSON válido y no dispara el .catch: `body.approve` reventaba con
  // TypeError → 500. Y Boolean("false") era true: solo `true` literal aprueba.
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  // La decisión tiene que venir dicha. Antes `approve` era `body.approve ===
  // true`, así que una petición sin el campo —o con otro nombre, o con
  // `"true"` como texto— RECHAZABA la propuesta: el error de un cliente se
  // convertía en una decisión irreversible sobre la tarima de otra zona.
  if (typeof body.approve !== "boolean") {
    return jsonError("Falta la decisión: «approve» debe ser true o false", 400);
  }
  const approve = body.approve;
  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 500) || undefined : undefined;
  // La pantalla lo pide («obligatorio al rechazar») y la revisión de ascensos
  // ya lo exigía; aquí se aceptaba un rechazo sin un solo motivo, y el
  // delegado recibía su tarima devuelta sin saber qué cambiar.
  if (!approve && !comment) {
    return jsonError("El motivo de rechazo es obligatorio", 400);
  }

  // El servicio devuelve undefined tanto si la propuesta no existe como si ya
  // fue revisada (o si otro revisor ganó la carrera): distingue 404 de 409. Y
  // por eso va antes del `try`, así que sin cubrirla un fallo de lectura salía
  // de Next como un 500 sin cuerpo JSON.
  const bandeja = await readOrError("approvals.review.bandeja", "No se pudo cargar la propuesta", () =>
    dataService.getApprovals(user),
  );
  if (bandeja instanceof Response) return bandeja;
  const existing = bandeja.find((a) => a.id === id);
  if (!existing) return jsonError("Propuesta no encontrada", 404);
  if (existing.status !== "pendiente") {
    return jsonError("La propuesta ya fue revisada", 409);
  }

  let result;
  try {
    result = await dataService.reviewApproval(id, approve, user.nombre, user.id, comment);
  } catch (err) {
    // Solo el motivo pensado para el revisor viaja al cliente (juez borrado del
    // censo, acta que no se pudo guardar). Antes salía el mensaje de CUALQUIER
    // excepción —incluido el texto de Postgres, con nombres de tabla y de
    // restricción— y encima disfrazado de conflicto.
    if (err instanceof ApprovalReviewError) return jsonError(err.message, 409);
    // `jsonRouteError` deja pasar además los motivos escritos para el revisor
    // desde el servicio (la revisión se guardó pero no se pudo releer, la
    // propuesta no se pudo leer). Antes morían en un 500 genérico.
    return jsonRouteError("approvals.review", err, "No se pudo revisar la propuesta");
  }
  if (!result) return jsonError("La propuesta ya fue revisada por otro usuario", 409);
  // Tarima aprobada: cada juez designado recibe su aviso. Después de
  // responder, para no hacer esperar al revisor.
  if (approve) afterResponse(() => notificarDesignacion(existing.competitionId, id));
  return jsonOk(result);
}
