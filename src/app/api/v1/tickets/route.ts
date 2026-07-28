import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import {
  isTicketCategory,
  isTicketStatus,
  validateDescripcion,
  validateTitulo,
} from "@/lib/tickets/validation";
import { extractTicketFiles } from "@/lib/tickets/form";
import { TicketsNotMigratedError } from "@/lib/tickets/service-types";
import type { TicketStatus } from "@/lib/types";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status");
  let status: TicketStatus | undefined;
  if (statusRaw !== null) {
    if (!isTicketStatus(statusRaw)) return jsonError("Estado no válido", 400);
    status = statusRaw;
  }

  try {
    return jsonOk(await dataService.getTickets({ user, status }));
  } catch (err) {
    return jsonServerError("tickets.GET", err, "No se pudieron cargar los tickets");
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError("Se esperaba multipart/form-data", 400);

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const categoria = formData.get("categoria");

  const tituloErr = validateTitulo(titulo);
  if (tituloErr) return jsonError(tituloErr, 400);
  const descripcionErr = validateDescripcion(descripcion);
  if (descripcionErr) return jsonError(descripcionErr, 400);
  if (!isTicketCategory(categoria)) return jsonError("Categoría no válida", 400);

  const { files, error: filesErr } = await extractTicketFiles(formData);
  if (filesErr) return jsonError(filesErr, 400);

  try {
    const ticket = await dataService.createTicket({
      user,
      titulo,
      descripcion,
      categoria,
      files,
    });
    return jsonOk(ticket);
  } catch (err) {
    if (err instanceof TicketsNotMigratedError) return jsonError(err.message, 503);
    return jsonServerError("tickets.POST", err, "No se pudo crear el ticket");
  }
}
