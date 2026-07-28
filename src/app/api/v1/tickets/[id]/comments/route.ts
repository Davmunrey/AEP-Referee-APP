import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import { validateCommentBody } from "@/lib/tickets/validation";
import { extractTicketFiles } from "@/lib/tickets/form";
import { TicketsNotMigratedError } from "@/lib/tickets/service-types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError("Se esperaba multipart/form-data", 400);

  const body = String(formData.get("body") ?? "").trim();
  const bodyErr = validateCommentBody(body);
  if (bodyErr) return jsonError(bodyErr, 400);

  const { files, error: filesErr } = await extractTicketFiles(formData);
  if (filesErr) return jsonError(filesErr, 400);

  try {
    const ticket = await dataService.addTicketComment({
      user,
      ticketId: id,
      body,
      files,
    });
    // 404 si no existe o el usuario no tiene visibilidad (no filtra existencia).
    if (!ticket) return jsonError("Ticket no encontrado", 404);
    return jsonOk(ticket);
  } catch (err) {
    if (err instanceof TicketsNotMigratedError) return jsonError(err.message, 503);
    return jsonServerError("tickets.comments.POST", err, "No se pudo añadir el comentario");
  }
}
