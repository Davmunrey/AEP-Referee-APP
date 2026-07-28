// Backend en memoria de los tickets de soporte (dev local sin Supabase). Misma
// API que supabase-tickets: los adjuntos se guardan como data URLs en `signedUrl`
// para que el frontend funcione igual sin bucket de storage.
import type {
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketComment,
} from "@/lib/types";
import { canAdminTickets } from "@/lib/tickets/validation";
import {
  type AddTicketCommentInput,
  type CreateTicketInput,
  type GetTicketsInput,
  type TicketFileInput,
  TicketPermissionError,
  type UpdateTicketStatusInput,
} from "@/lib/tickets/service-types";

interface StoredAttachment {
  id: string;
  ticketId: string;
  commentId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
}

interface StoredComment {
  id: string;
  ticketId: string;
  authorId?: string;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: StoredAttachment[];
}

interface StoredTicket {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: SupportTicket["categoria"];
  status: SupportTicket["status"];
  createdById?: string;
  createdByName: string;
  createdByRole?: string;
  zona?: string;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  attachments: StoredAttachment[];
  comments: StoredComment[];
}

// Colgado de globalThis como el resto de stores en memoria: en dev con HMR y
// bundles por ruta cada instancia del módulo tendría su propio Map.
const globalForTickets = globalThis as unknown as {
  __aepTicketsStore?: Map<string, StoredTicket>;
};
const store = (globalForTickets.__aepTicketsStore ??= new Map<string, StoredTicket>());

/** Solo para tests: vacía el store en memoria. */
export function __resetTicketsStore(): void {
  store.clear();
}

function toDataUrl(file: TicketFileInput): string {
  const base64 = Buffer.from(file.bytes).toString("base64");
  return `data:${file.contentType};base64,${base64}`;
}

function storeAttachment(
  ticketId: string,
  commentId: string | null,
  file: TicketFileInput,
): StoredAttachment {
  return {
    id: `tatt-${crypto.randomUUID()}`,
    ticketId,
    commentId,
    fileName: file.fileName,
    contentType: file.contentType,
    sizeBytes: file.size,
    dataUrl: toDataUrl(file),
    createdAt: new Date().toISOString(),
  };
}

function mapAttachment(att: StoredAttachment): SupportTicketAttachment {
  return {
    id: att.id,
    ticketId: att.ticketId,
    commentId: att.commentId,
    fileName: att.fileName,
    contentType: att.contentType,
    sizeBytes: att.sizeBytes,
    signedUrl: att.dataUrl,
    createdAt: att.createdAt,
  };
}

function mapComment(comment: StoredComment): SupportTicketComment {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt,
    attachments: comment.attachments.map(mapAttachment),
  };
}

function mapTicket(
  ticket: StoredTicket,
  { withComments }: { withComments: boolean },
): SupportTicket {
  return {
    id: ticket.id,
    titulo: ticket.titulo,
    descripcion: ticket.descripcion,
    categoria: ticket.categoria,
    status: ticket.status,
    createdById: ticket.createdById,
    createdByName: ticket.createdByName,
    createdByRole: ticket.createdByRole,
    zona: ticket.zona,
    resolutionNote: ticket.resolutionNote,
    resolvedBy: ticket.resolvedBy,
    resolvedAt: ticket.resolvedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    attachments: ticket.attachments.map(mapAttachment),
    comments: withComments ? ticket.comments.map(mapComment) : [],
    commentCount: ticket.comments.length,
  };
}

function canView(user: GetTicketsInput["user"], ticket: StoredTicket): boolean {
  return canAdminTickets(user) || ticket.createdById === user.id;
}

export const ticketService = {
  getTickets: async ({ user, status }: GetTicketsInput): Promise<SupportTicket[]> => {
    return [...store.values()]
      .filter((t) => canView(user, t))
      .filter((t) => (status ? t.status === status : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((t) => mapTicket(t, { withComments: false }));
  },

  getTicket: async (
    id: string,
    user: GetTicketsInput["user"],
  ): Promise<SupportTicket | undefined> => {
    const ticket = store.get(id);
    if (!ticket || !canView(user, ticket)) return undefined;
    return mapTicket(ticket, { withComments: true });
  },

  createTicket: async ({
    user,
    titulo,
    descripcion,
    categoria,
    files = [],
  }: CreateTicketInput): Promise<SupportTicket> => {
    const id = `tick-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const ticket: StoredTicket = {
      id,
      titulo,
      descripcion,
      categoria,
      status: "abierto",
      createdById: user.id,
      createdByName: user.nombre,
      createdByRole: user.role,
      zona: user.zona,
      createdAt: now,
      updatedAt: now,
      attachments: files.map((f) => storeAttachment(id, null, f)),
      comments: [],
    };
    store.set(id, ticket);
    return mapTicket(ticket, { withComments: true });
  },

  addComment: async ({
    user,
    ticketId,
    body,
    files = [],
  }: AddTicketCommentInput): Promise<SupportTicket | undefined> => {
    const ticket = store.get(ticketId);
    if (!ticket || !canView(user, ticket)) return undefined;
    const commentId = `tcm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    ticket.comments.push({
      id: commentId,
      ticketId,
      authorId: user.id,
      authorName: user.nombre,
      body,
      createdAt: now,
      attachments: files.map((f) => storeAttachment(ticketId, commentId, f)),
    });
    ticket.updatedAt = now;
    return mapTicket(ticket, { withComments: true });
  },

  updateTicketStatus: async ({
    user,
    ticketId,
    status,
    resolutionNote,
  }: UpdateTicketStatusInput): Promise<SupportTicket | undefined> => {
    const ticket = store.get(ticketId);
    if (!ticket) return undefined;
    const admin = canAdminTickets(user);
    const isOwner = ticket.createdById === user.id;
    if (!admin) {
      if (!isOwner) return undefined;
      if (status !== "cerrado") {
        throw new TicketPermissionError("Solo puedes cerrar tus propios tickets");
      }
    }
    const now = new Date().toISOString();
    ticket.status = status;
    ticket.updatedAt = now;
    if (status === "resuelto") {
      ticket.resolvedBy = user.nombre;
      ticket.resolvedAt = now;
      if (resolutionNote !== undefined) ticket.resolutionNote = resolutionNote;
    }
    return mapTicket(ticket, { withComments: true });
  },
};
