import { beforeEach, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/types";
import {
  isTicketAdmin,
  isTicketCategory,
  isTicketStatus,
  sanitizeFileName,
  validateCommentBody,
  validateDescripcion,
  validateFile,
  validateFiles,
  validateTitulo,
} from "@/lib/tickets/validation";
import type { TicketFileInput } from "@/lib/tickets/service-types";
import { TicketPermissionError } from "@/lib/tickets/service-types";
import {
  __resetTicketsStore,
  ticketService,
} from "@/server/services/memory-tickets";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "u-1",
    email: "u1@aep.test",
    nombre: "Usuario Uno",
    rol: "Solo Ver",
    iniciales: "U1",
    role: "solo_ver",
    ...overrides,
  };
}

function makeFile(overrides: Partial<TicketFileInput> = {}): TicketFileInput {
  const bytes = new TextEncoder().encode("contenido").buffer;
  return {
    fileName: "foto.png",
    contentType: "image/png",
    size: 9,
    bytes,
    ...overrides,
  };
}

// ── Whitelists ────────────────────────────────────────────────────────────────
describe("whitelists de categoría y estado", () => {
  it("acepta solo categorías válidas", () => {
    expect(isTicketCategory("incidencia")).toBe(true);
    expect(isTicketCategory("mejora")).toBe(true);
    expect(isTicketCategory("bug")).toBe(false);
    expect(isTicketCategory(42)).toBe(false);
  });

  it("acepta solo estados válidos", () => {
    expect(isTicketStatus("abierto")).toBe(true);
    expect(isTicketStatus("resuelto")).toBe(true);
    expect(isTicketStatus("pendiente")).toBe(false);
    expect(isTicketStatus(null)).toBe(false);
  });
});

// ── Límites de campos ───────────────────────────────────────────────────────
describe("límites de campos de texto", () => {
  it("título entre 4 y 140 caracteres", () => {
    expect(validateTitulo("abc")).not.toBeNull();
    expect(validateTitulo("abcd")).toBeNull();
    expect(validateTitulo("x".repeat(140))).toBeNull();
    expect(validateTitulo("x".repeat(141))).not.toBeNull();
    expect(validateTitulo(123)).not.toBeNull();
  });

  it("descripción entre 10 y 5000 caracteres", () => {
    expect(validateDescripcion("corto")).not.toBeNull();
    expect(validateDescripcion("x".repeat(10))).toBeNull();
    expect(validateDescripcion("x".repeat(5000))).toBeNull();
    expect(validateDescripcion("x".repeat(5001))).not.toBeNull();
  });

  it("comentario entre 1 y 3000 caracteres", () => {
    expect(validateCommentBody("")).not.toBeNull();
    expect(validateCommentBody("a")).toBeNull();
    expect(validateCommentBody("x".repeat(3000))).toBeNull();
    expect(validateCommentBody("x".repeat(3001))).not.toBeNull();
  });
});

// ── Ficheros ─────────────────────────────────────────────────────────────────
describe("validación de ficheros", () => {
  it("rechaza tipos no permitidos", () => {
    expect(validateFile({ fileName: "a.pdf", contentType: "application/pdf", size: 10 })).not.toBeNull();
    expect(validateFile({ fileName: "a.png", contentType: "image/png", size: 10 })).toBeNull();
  });

  it("rechaza ficheros de más de 5 MB", () => {
    expect(validateFile({ fileName: "big.jpg", contentType: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).not.toBeNull();
    expect(validateFile({ fileName: "ok.jpg", contentType: "image/jpeg", size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("rechaza más de 5 ficheros", () => {
    const meta = { fileName: "a.png", contentType: "image/png", size: 10 };
    expect(validateFiles(Array(5).fill(meta))).toBeNull();
    expect(validateFiles(Array(6).fill(meta))).not.toBeNull();
  });
});

describe("sanitizeFileName", () => {
  it("elimina caracteres peligrosos de la ruta", () => {
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFileName("mi foto (1).png")).toBe("mi_foto_1_.png");
    expect(sanitizeFileName("")).toBe("adjunto");
  });
});

describe("isTicketAdmin", () => {
  it("solo super_admin y delegado_jueces son admins de tickets", () => {
    expect(isTicketAdmin(makeUser({ role: "super_admin" }))).toBe(true);
    expect(isTicketAdmin(makeUser({ role: "delegado_jueces" }))).toBe(true);
    expect(isTicketAdmin(makeUser({ role: "delegado_zona" }))).toBe(false);
    expect(isTicketAdmin(makeUser({ role: "solo_ver" }))).toBe(false);
  });
});

// ── Flujo del backend en memoria ──────────────────────────────────────────────
describe("memory ticketService — flujo completo", () => {
  beforeEach(() => __resetTicketsStore());

  const author = makeUser({ id: "author-1", nombre: "Autor", role: "solo_ver" });
  const admin = makeUser({ id: "admin-1", nombre: "Admin", role: "super_admin" });
  const other = makeUser({ id: "other-1", nombre: "Otro", role: "delegado_zona" });

  it("crear → listar → comentar → resolver", async () => {
    const created = await ticketService.createTicket({
      user: author,
      titulo: "No carga la tarima",
      descripcion: "Al abrir la tarima aparece un error persistente.",
      categoria: "incidencia",
      files: [makeFile()],
    });
    expect(created.id).toMatch(/^tick-/);
    expect(created.status).toBe("abierto");
    expect(created.attachments).toHaveLength(1);
    expect(created.attachments[0].signedUrl).toMatch(/^data:image\/png;base64,/);

    const list = await ticketService.getTickets({ user: author });
    expect(list).toHaveLength(1);
    expect(list[0].comments).toHaveLength(0); // vacío en listado
    expect(list[0].commentCount).toBe(0);

    const commented = await ticketService.addComment({
      user: admin,
      ticketId: created.id,
      body: "Estamos en ello.",
      files: [],
    });
    expect(commented?.comments).toHaveLength(1);
    expect(commented?.commentCount).toBe(1);

    const resolved = await ticketService.updateTicketStatus({
      user: admin,
      ticketId: created.id,
      status: "resuelto",
      resolutionNote: "Corregido en la v2.2",
    });
    expect(resolved?.status).toBe("resuelto");
    expect(resolved?.resolvedBy).toBe("Admin");
    expect(resolved?.resolvedAt).toBeTruthy();
    expect(resolved?.resolutionNote).toBe("Corregido en la v2.2");
  });

  it("visibilidad: el autor y los admins ven el ticket; terceros no", async () => {
    const created = await ticketService.createTicket({
      user: author,
      titulo: "Ticket privado",
      descripcion: "Contenido solo del autor y los admins.",
      categoria: "duda",
    });

    expect(await ticketService.getTicket(created.id, author)).toBeDefined();
    expect(await ticketService.getTicket(created.id, admin)).toBeDefined();
    expect(await ticketService.getTicket(created.id, other)).toBeUndefined();

    expect(await ticketService.getTickets({ user: author })).toHaveLength(1);
    expect(await ticketService.getTickets({ user: admin })).toHaveLength(1);
    expect(await ticketService.getTickets({ user: other })).toHaveLength(0);
  });

  it("el creador solo puede cerrar; no puede resolver", async () => {
    const created = await ticketService.createTicket({
      user: author,
      titulo: "Cierre por el autor",
      descripcion: "El autor decide cerrar su propio ticket.",
      categoria: "otro",
    });

    await expect(
      ticketService.updateTicketStatus({
        user: author,
        ticketId: created.id,
        status: "resuelto",
      }),
    ).rejects.toBeInstanceOf(TicketPermissionError);

    const closed = await ticketService.updateTicketStatus({
      user: author,
      ticketId: created.id,
      status: "cerrado",
    });
    expect(closed?.status).toBe("cerrado");
  });

  it("un tercero no puede comentar ni cambiar el estado", async () => {
    const created = await ticketService.createTicket({
      user: author,
      titulo: "Ajeno",
      descripcion: "Un tercero no debería poder tocar este ticket.",
      categoria: "incidencia",
    });

    expect(
      await ticketService.addComment({ user: other, ticketId: created.id, body: "hola" }),
    ).toBeUndefined();
    expect(
      await ticketService.updateTicketStatus({ user: other, ticketId: created.id, status: "cerrado" }),
    ).toBeUndefined();
  });
});
