import type { PostgrestError } from "@supabase/supabase-js";
import type {
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketComment,
} from "@/lib/types";
import { canAdminTickets, sanitizeFileName } from "@/lib/tickets/validation";
import {
  type AddTicketCommentInput,
  type CreateTicketInput,
  type GetTicketsInput,
  type TicketFileInput,
  TicketPermissionError,
  TicketsNotMigratedError,
  type UpdateTicketStatusInput,
} from "@/lib/tickets/service-types";
import { db, warnMissingMigration } from "./supabase-helpers";

const BUCKET = "ticket-attachments";
const SIGNED_URL_TTL = 3600;

// ── Detección de "feature no migrada" ───────────────────────────────────────
// Si aún no se ha aplicado la migración 035, la tabla no existe: Postgres
// devuelve 42P01 y PostgREST PGRST205 (no está en la caché del esquema). En
// lecturas lo tratamos como lista vacía; en escrituras, error legible.
function isMissingTable(error: PostgrestError | null): boolean {
  if (!error) return false;
  const falta =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|could not find the table/i.test(error.message ?? "");
  // Degradar en silencio dejaba invisible que la 035 no se había aplicado: la
  // zona de soporte se veía vacía y en paz. Un aviso por proceso en el log.
  if (falta) warnMissingMigration("support_tickets (migración 035)");
  return falta;
}

// ── Filas crudas ────────────────────────────────────────────────────────────
type TicketRow = Record<string, unknown>;

function mapAttachment(
  row: TicketRow,
  signedUrl?: string,
): SupportTicketAttachment {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    commentId: (row.comment_id as string | null) ?? null,
    fileName: String(row.file_name),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    signedUrl,
    createdAt: String(row.created_at),
  };
}

function mapComment(
  row: TicketRow,
  attachments: SupportTicketAttachment[],
): SupportTicketComment {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    authorId: (row.author_id as string | undefined) ?? undefined,
    authorName: String(row.author_name),
    body: String(row.body),
    createdAt: String(row.created_at),
    attachments,
  };
}

function mapTicket(
  row: TicketRow,
  attachments: SupportTicketAttachment[],
  comments: SupportTicketComment[],
  commentCount: number,
): SupportTicket {
  return {
    id: String(row.id),
    titulo: String(row.titulo),
    descripcion: String(row.descripcion),
    categoria: row.categoria as SupportTicket["categoria"],
    status: row.status as SupportTicket["status"],
    createdById: (row.created_by_id as string | undefined) ?? undefined,
    createdByName: String(row.created_by_name),
    createdByRole: (row.created_by_role as string | undefined) ?? undefined,
    zona: (row.zona as string | undefined) ?? undefined,
    resolutionNote: (row.resolution_note as string | undefined) ?? undefined,
    resolvedBy: (row.resolved_by as string | undefined) ?? undefined,
    resolvedAt: (row.resolved_at as string | undefined) ?? undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    attachments,
    comments,
    commentCount,
  };
}

// ── Storage ─────────────────────────────────────────────────────────────────
/** Genera una URL firmada de corta duración para cada adjunto (no falla duro). */
async function signAttachments(rows: TicketRow[]): Promise<SupportTicketAttachment[]> {
  const supabase = db();
  return Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(String(row.storage_path), SIGNED_URL_TTL);
      return mapAttachment(row, data?.signedUrl);
    }),
  );
}

/**
 * Sube los ficheros al bucket e inserta las filas de adjunto. Se llama DESPUÉS
 * de insertar el ticket/comentario para no dejar ficheros huérfanos. Si una
 * subida falla, sigue con las demás y devuelve el nombre de la que se quedó
 * fuera: un fallo aquí no debe tumbar el ticket, pero tampoco puede acabar
 * solo en el log del servidor mientras el usuario cree que adjuntó su prueba.
 */
async function uploadAttachments(
  ticketId: string,
  commentId: string | null,
  files: TicketFileInput[],
): Promise<string[]> {
  const fallidos: string[] = [];
  if (files.length === 0) return fallidos;
  const supabase = db();
  for (const file of files) {
    const path = `tickets/${ticketId}/${crypto.randomUUID()}-${sanitizeFileName(file.fileName)}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file.bytes, { contentType: file.contentType, upsert: false });
    if (uploadError) {
      console.warn(`[tickets] adjunto no subido (${file.fileName}):`, uploadError.message);
      fallidos.push(file.fileName);
      continue;
    }
    const { error: insertError } = await supabase.from("support_ticket_attachments").insert({
      id: `tatt-${crypto.randomUUID()}`,
      ticket_id: ticketId,
      comment_id: commentId,
      storage_path: path,
      file_name: file.fileName,
      content_type: file.contentType,
      size_bytes: file.size,
    });
    if (insertError) {
      console.warn(`[tickets] fila de adjunto no insertada (${file.fileName}):`, insertError.message);
      fallidos.push(file.fileName);
      // Limpia el fichero huérfano: no hay fila que lo referencie.
      await supabase.storage.from(BUCKET).remove([path]);
    }
  }
  return fallidos;
}

/** ¿Puede el usuario ver este ticket? Autor o admin. */
function canView(user: CreateTicketInput["user"], createdById: string | null): boolean {
  return canAdminTickets(user) || createdById === user.id;
}

export const ticketService = {
  getTickets: async ({ user, status }: GetTicketsInput): Promise<SupportTicket[]> => {
    const supabase = db();
    let query = supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!canAdminTickets(user)) query = query.eq("created_by_id", user.id);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error)) return []; // feature no migrada
      throw error;
    }
    const tickets = data ?? [];
    if (tickets.length === 0) return [];
    const ids = tickets.map((t) => String(t.id));

    // commentCount agregado en una sola consulta (evita N+1).
    const { data: commentRows, error: commentsError } = await supabase
      .from("support_ticket_comments")
      .select("ticket_id")
      .in("ticket_id", ids);
    // El contador se pinta siempre, así que un fallo de lectura ponía un «0»
    // en cada ticket: «nadie te ha contestado» dicho por un corte de red.
    if (commentsError) throw commentsError;
    const counts = new Map<string, number>();
    for (const row of commentRows ?? []) {
      const key = String(row.ticket_id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Adjuntos a nivel de ticket (comment_id NULL) en una sola consulta.
    const { data: attachmentRows, error: attachmentsError } = await supabase
      .from("support_ticket_attachments")
      .select("*")
      .in("ticket_id", ids)
      .is("comment_id", null);
    if (attachmentsError) throw attachmentsError;
    const signed = await signAttachments(attachmentRows ?? []);
    const byTicket = new Map<string, SupportTicketAttachment[]>();
    for (const att of signed) {
      const bucket = byTicket.get(att.ticketId);
      if (bucket) bucket.push(att);
      else byTicket.set(att.ticketId, [att]);
    }

    return tickets.map((row) =>
      mapTicket(
        row,
        byTicket.get(String(row.id)) ?? [],
        [],
        counts.get(String(row.id)) ?? 0,
      ),
    );
  },

  getTicket: async (
    id: string,
    user: GetTicketsInput["user"],
  ): Promise<SupportTicket | undefined> => {
    const supabase = db();
    const { data: row, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return undefined;
      throw error;
    }
    if (!row) return undefined;
    if (!canView(user, (row.created_by_id as string | null) ?? null)) return undefined;

    const [
      { data: commentRows, error: commentsError },
      { data: attachmentRows, error: attachmentsError },
    ] = await Promise.all([
      supabase
        .from("support_ticket_comments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("support_ticket_attachments").select("*").eq("ticket_id", id),
    ]);
    // El hilo entero es lo que se viene a leer: presentarlo vacío porque la
    // lectura falló hace que el usuario crea que su comentario se perdió y que
    // quien atiende conteste sin haber visto lo que ya se había dicho.
    if (commentsError) throw commentsError;
    if (attachmentsError) throw attachmentsError;

    const signed = await signAttachments(attachmentRows ?? []);
    const ticketAttachments = signed.filter((a) => a.commentId === null);
    const byComment = new Map<string, SupportTicketAttachment[]>();
    for (const att of signed) {
      if (att.commentId === null) continue;
      const bucket = byComment.get(att.commentId);
      if (bucket) bucket.push(att);
      else byComment.set(att.commentId, [att]);
    }

    const comments = (commentRows ?? []).map((c) =>
      mapComment(c, byComment.get(String(c.id)) ?? []),
    );
    return mapTicket(row, ticketAttachments, comments, comments.length);
  },

  createTicket: async ({
    user,
    titulo,
    descripcion,
    categoria,
    files = [],
  }: CreateTicketInput): Promise<SupportTicket> => {
    const supabase = db();
    const id = `tick-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const { error } = await supabase.from("support_tickets").insert({
      id,
      titulo,
      descripcion,
      categoria,
      status: "abierto",
      created_by_id: user.id,
      created_by_name: user.nombre,
      created_by_role: user.role,
      zona: user.zona ?? null,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      if (isMissingTable(error)) throw new TicketsNotMigratedError();
      throw error;
    }
    // Los ficheros se suben DESPUÉS del insert: si el insert fallara no dejaríamos
    // ficheros huérfanos en el bucket.
    const fallidos = await uploadAttachments(id, null, files);
    const ticket = await ticketService.getTicket(id, user);
    if (!ticket) throw new Error("No se pudo leer el ticket recién creado");
    return fallidos.length ? { ...ticket, attachmentWarnings: fallidos } : ticket;
  },

  addComment: async ({
    user,
    ticketId,
    body,
    files = [],
  }: AddTicketCommentInput): Promise<SupportTicket | undefined> => {
    const supabase = db();
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select("created_by_id")
      .eq("id", ticketId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) throw new TicketsNotMigratedError();
      throw error;
    }
    if (!ticket) return undefined;
    if (!canView(user, (ticket.created_by_id as string | null) ?? null)) return undefined;

    const commentId = `tcm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("support_ticket_comments").insert({
      id: commentId,
      ticket_id: ticketId,
      author_id: user.id,
      author_name: user.nombre,
      body,
      created_at: now,
    });
    if (insertError) throw insertError;

    const fallidos = await uploadAttachments(ticketId, commentId, files);
    // Un comentario nuevo mueve el ticket al principio de la lista.
    await supabase.from("support_tickets").update({ updated_at: now }).eq("id", ticketId);
    const actualizado = await ticketService.getTicket(ticketId, user);
    if (actualizado && fallidos.length) {
      return { ...actualizado, attachmentWarnings: fallidos };
    }
    return actualizado;
  },

  updateTicketStatus: async ({
    user,
    ticketId,
    status,
    resolutionNote,
  }: UpdateTicketStatusInput): Promise<SupportTicket | undefined> => {
    const supabase = db();
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select("created_by_id")
      .eq("id", ticketId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) throw new TicketsNotMigratedError();
      throw error;
    }
    if (!ticket) return undefined;

    const admin = canAdminTickets(user);
    const isOwner = (ticket.created_by_id as string | null) === user.id;
    if (!admin) {
      if (!isOwner) return undefined; // no revela existencia
      // El creador solo puede cerrar su propio ticket.
      if (status !== "cerrado") {
        throw new TicketPermissionError("Solo puedes cerrar tus propios tickets");
      }
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (status === "resuelto") {
      patch.resolved_by = user.nombre;
      patch.resolved_at = now;
      // Siempre explícita: si el ticket se reabrió y se vuelve a resolver sin
      // nota, dejarla sin tocar resucitaba la nota de la resolución anterior
      // como si fuera la de ahora.
      patch.resolution_note = resolutionNote ?? null;
    }
    // Guard condicional: acota por id para no pisar otras filas.
    const { error: updateError } = await supabase
      .from("support_tickets")
      .update(patch)
      .eq("id", ticketId);
    if (updateError) throw updateError;
    return ticketService.getTicket(ticketId, user);
  },
};
