// Tipos de entrada compartidos por los dos backends de tickets (Supabase y
// memoria) y por las rutas API. Estar en un módulo neutro evita que el backend
// en memoria tenga que importar del backend de Supabase solo por los tipos.
import type { SessionUser, TicketCategory, TicketStatus } from "@/lib/types";

/** Fichero adjunto ya leído en memoria, listo para subir/guardar. */
export interface TicketFileInput {
  fileName: string;
  contentType: string;
  size: number;
  bytes: ArrayBuffer;
}

export interface GetTicketsInput {
  user: SessionUser;
  status?: TicketStatus;
}

export interface CreateTicketInput {
  user: SessionUser;
  titulo: string;
  descripcion: string;
  categoria: TicketCategory;
  files?: TicketFileInput[];
}

export interface AddTicketCommentInput {
  user: SessionUser;
  ticketId: string;
  body: string;
  files?: TicketFileInput[];
}

export interface UpdateTicketStatusInput {
  user: SessionUser;
  ticketId: string;
  status: TicketStatus;
  resolutionNote?: string;
}

/**
 * Error de negocio de la capa de tickets (permiso o transición inválida). Las
 * rutas lo distinguen de un fallo genérico para responder 403 en vez de 500.
 */
export class TicketPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketPermissionError";
  }
}

/** La feature aún no está migrada (tabla inexistente) en una escritura. */
export class TicketsNotMigratedError extends Error {
  constructor(message = "Aplica la migración 035 para usar los tickets de soporte") {
    super(message);
    this.name = "TicketsNotMigratedError";
  }
}
