import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import { canAdminTickets, DESCRIPCION_MAX, isTicketStatus } from "@/lib/tickets/validation";
import {
  TicketPermissionError,
  TicketsNotMigratedError,
} from "@/lib/tickets/service-types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  try {
    const ticket = await dataService.getTicket(id, user);
    // 404 tanto si no existe como si el usuario no tiene visibilidad: no se
    // filtra la existencia de tickets ajenos.
    if (!ticket) return jsonError("Ticket no encontrado", 404);
    return jsonOk(ticket);
  } catch (err) {
    return jsonServerError("tickets.detail.GET", err, "No se pudo cargar el ticket");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    resolutionNote?: unknown;
  } | null;
  if (!body || typeof body !== "object") return jsonError("Cuerpo de solicitud inválido", 400);

  if (body.status === undefined) return jsonError("Falta el estado", 400);
  if (!isTicketStatus(body.status)) return jsonError("Estado no válido", 400);

  // Guard RBAC explícito, antes de tocar la base: solo un admin de soporte
  // puede llevar un ticket a cualquier estado. Quien no lo es como mucho podrá
  // cerrar, y solo los suyos — la propiedad la comprueba el servicio, que es
  // quien conoce al creador. Este corte es un prefijo estricto de esa regla,
  // así que no puede divergir de ella.
  if (!canAdminTickets(user) && body.status !== "cerrado") {
    return jsonError("Solo puedes cerrar tus propios tickets", 403);
  }

  let resolutionNote: string | undefined;
  if (body.resolutionNote !== undefined) {
    if (typeof body.resolutionNote !== "string") return jsonError("Nota de resolución inválida", 400);
    resolutionNote = body.resolutionNote.trim();
    if (resolutionNote.length > DESCRIPCION_MAX) {
      return jsonError(`La nota no puede superar ${DESCRIPCION_MAX} caracteres`, 400);
    }
  }

  try {
    const updated = await dataService.updateTicketStatus({
      user,
      ticketId: id,
      status: body.status,
      resolutionNote,
    });
    if (!updated) return jsonError("Ticket no encontrado", 404);
    return jsonOk(updated);
  } catch (err) {
    if (err instanceof TicketPermissionError) return jsonError(err.message, 403);
    if (err instanceof TicketsNotMigratedError) return jsonError(err.message, 503);
    return jsonServerError("tickets.detail.PATCH", err, "No se pudo actualizar el ticket");
  }
}
