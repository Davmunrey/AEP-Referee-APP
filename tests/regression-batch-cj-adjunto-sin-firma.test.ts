import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cada adjunto de un ticket se sirve con una URL firmada de corta duración.
 * Cuando firmarla falla —el almacenamiento no responde, la política del
 * bucket, la clave caducada— el error se tiraba, el adjunto salía sin URL, y
 * la pantalla filtraba los adjuntos sin URL: la captura de un fallo
 * desaparecía del ticket sin dejar rastro. Quien lo abría veía menos adjuntos
 * de los que subió, y nada explicaba por qué.
 */

let firmaFalla = false;
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () =>
          firmaFalla
            ? { data: null, error: { message: "Object not found" } }
            : { data: { signedUrl: "https://firmada/x" }, error: null },
      }),
    },
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      const fila = {
        id: "tick-1", titulo: "Falla la tarima", descripcion: "Se queda en blanco",
        categoria: "incidencia", status: "abierto", created_by_id: "u1", created_by_name: "Ana",
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      };
      const adjunto = {
        id: "tatt-1", ticket_id: "tick-1", comment_id: null, storage_path: "tickets/tick-1/a.png",
        file_name: "captura.png", content_type: "image/png", size_bytes: 10, created_at: "2026-01-01T00:00:00Z",
      };
      const resultado = () => {
        if (table === "support_tickets") return { data: fila, error: null };
        if (table === "support_ticket_attachments") return { data: [adjunto], error: null };
        return { data: [], error: null };
      };
      Object.assign(q, {
        select: () => q, eq: () => q, in: () => q, is: () => q, order: () => q,
        range: async () => ({ data: table === "support_ticket_attachments" ? [adjunto] : [], error: null }),
        maybeSingle: async () => resultado(),
        single: async () => resultado(),
        then: (r: (v: unknown) => unknown) => Promise.resolve(resultado()).then(r),
      });
      return q;
    },
  }),
}));

const { ticketService } = await import("@/server/services/supabase-tickets");
const ADMIN = { id: "u1", nombre: "Ana", iniciales: "AN", email: "a@b.es", rol: "Admin", role: "super_admin" } as const;

beforeEach(() => {
  firmaFalla = false;
  consoleError.mockClear();
});

describe("un adjunto que no se puede firmar sigue existiendo", () => {
  it("se devuelve con su nombre y sin URL, y el fallo queda en el log", async () => {
    firmaFalla = true;
    const ticket = await ticketService.getTicket("tick-1", ADMIN as never);
    expect(ticket?.attachments).toHaveLength(1);
    expect(ticket?.attachments[0]).toMatchObject({ fileName: "captura.png", signedUrl: undefined });
    expect(consoleError).toHaveBeenCalledWith("[tickets.firmar]", "tickets/tick-1/a.png", "Object not found");
  });

  it("y cuando se firma, lleva su URL", async () => {
    const ticket = await ticketService.getTicket("tick-1", ADMIN as never);
    expect(ticket?.attachments[0]?.signedUrl).toBe("https://firmada/x");
  });
});

describe("la pantalla ya no lo esconde", () => {
  it("las galerías pintan todos los adjuntos, con o sin URL", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/components/tickets/ticket-detail.tsx"), "utf8");
    expect(src).not.toMatch(/attachments\.filter\(\(a\) => a\.signedUrl\)/);
    expect(src).toContain("AttachmentUnavailable");
  });
});
