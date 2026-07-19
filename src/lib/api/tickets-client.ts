import { getApiBaseUrl } from "@/lib/api/config";
import type { SupportTicket, SupportTicketComment, TicketStatus } from "@/lib/types";

// Cliente REST de tickets. Usa `fetch` directo con getApiBaseUrl() (igual que
// /sign-in) porque los envíos con adjuntos son multipart/form-data y no encajan
// en el api client JSON de src/lib/api/client. No se toca el aggregate client.

/** Límites del contrato de la API de adjuntos (validación de cliente). */
export const TICKET_MAX_FILES = 5;
export const TICKET_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const TICKET_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
/** Valor para el atributo `accept` del <input type="file">. */
export const TICKET_ACCEPT_ATTR = "image/jpeg,image/png,image/webp,image/gif";

/**
 * Valida en cliente los ficheros elegidos contra los límites del backend para
 * dar feedback inmediato. Devuelve un mensaje de error o `null` si todo va bien.
 */
export function validateTicketFiles(files: File[]): string | null {
  if (files.length > TICKET_MAX_FILES) {
    return `Puedes adjuntar como máximo ${TICKET_MAX_FILES} fotos.`;
  }
  for (const file of files) {
    if (!(TICKET_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      return `Formato no admitido en «${file.name}». Usa JPG, PNG, WEBP o GIF.`;
    }
    if (file.size > TICKET_MAX_FILE_BYTES) {
      return `«${file.name}» supera el límite de 5 MB por foto.`;
    }
  }
  return null;
}

async function unwrap<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // respuesta sin cuerpo JSON
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Error del servidor (${res.status}).`;
    throw new Error(message);
  }
  return (body as { data: T }).data;
}

/** POST multipart → crea un ticket con adjuntos opcionales. */
export async function createTicket(form: FormData): Promise<SupportTicket> {
  const res = await fetch(`${getApiBaseUrl()}/tickets`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return unwrap<SupportTicket>(res);
}

/** POST multipart → añade un comentario (con adjuntos opcionales) a un ticket. */
export async function addTicketComment(
  ticketId: string,
  form: FormData,
): Promise<SupportTicketComment> {
  const res = await fetch(`${getApiBaseUrl()}/tickets/${ticketId}/comments`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return unwrap<SupportTicketComment>(res);
}

/** PATCH JSON → cambia estado y/o nota de resolución de un ticket. */
export async function patchTicket(
  ticketId: string,
  payload: { status?: TicketStatus; resolutionNote?: string },
): Promise<SupportTicket> {
  const res = await fetch(`${getApiBaseUrl()}/tickets/${ticketId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrap<SupportTicket>(res);
}
