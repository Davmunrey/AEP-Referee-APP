import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachmentWarningMessage } from "@/lib/tickets/attachment-warning";

describe("el aviso de adjunto perdido", () => {
  it("no dice nada cuando no hay nada que decir", () => {
    expect(attachmentWarningMessage(undefined)).toBeNull();
    expect(attachmentWarningMessage([])).toBeNull();
  });

  it("nombra el fichero y dice qué hacer", () => {
    const msg = attachmentWarningMessage(["captura.png"]);
    expect(msg).toMatch(/captura\.png/);
    expect(msg).toMatch(/Vuelve a adjuntarlo/);
  });

  it("con varios, los cuenta y los nombra", () => {
    const msg = attachmentWarningMessage(["a.png", "b.pdf"]);
    expect(msg).toMatch(/2 adjuntos/);
    expect(msg).toMatch(/a\.png, b\.pdf/);
  });
});

// ── El servicio: qué llega en la respuesta ───────────────────────────────────

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
let respond: (ctx: { table: string; op: string }) => QueryResult;
let subidaFalla: boolean;
let borrados: string[][];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: async () =>
          subidaFalla ? { error: { message: "bucket full" } } : { error: null },
        remove: async (paths: string[]) => (borrados.push(paths), { error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "https://x/y" } }),
      }),
    },
    from: (table: string) => {
      const state = { table, op: "select" };
      const finish = () => respond(state);
      const q = {
        select: () => q,
        insert: () => ((state.op = "insert"), q),
        update: () => ((state.op = "update"), q),
        delete: () => ((state.op = "delete"), q),
        eq: () => q,
        in: () => q,
        order: () => q,
        limit: () => q,
        range: async () => finish(),
        single: async () => finish(),
        maybeSingle: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

const { ticketService } = await import("@/server/services/supabase-tickets");

const TICKET = {
  id: "tick-1",
  titulo: "No carga la tarima",
  descripcion: "Se queda en blanco",
  categoria: "incidencia",
  status: "abierto",
  created_by_id: "u1",
  created_by_name: "Ana",
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

const USER = { id: "u1", nombre: "Ana", role: "delegado_zona", zona: "CENTRO" } as never;

const fichero = {
  fileName: "captura.png",
  contentType: "image/png",
  size: 10,
  bytes: new Uint8Array([1, 2, 3]),
} as never;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  subidaFalla = false;
  borrados = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  respond = ({ table, op }) => {
    if (table === "support_tickets" && op === "select") return { data: TICKET, error: null };
    return { data: [], error: null };
  };
});

describe("crear un ticket cuyo adjunto no llega a subirse", () => {
  it("el ticket se crea igual, pero la respuesta dice qué adjunto falta", async () => {
    // Antes: `console.warn` en el servidor y punto. El ticket salía como
    // creado, la captura no estaba, y quien la adjuntó no se enteraba.
    subidaFalla = true;
    const ticket = await ticketService.createTicket({
      user: USER,
      titulo: TICKET.titulo,
      descripcion: TICKET.descripcion,
      categoria: "incidencia",
      files: [fichero],
    });
    expect(ticket.id).toBe("tick-1");
    expect(ticket.attachmentWarnings).toEqual(["captura.png"]);
  });

  it("cuando la subida va bien no hay aviso ninguno", async () => {
    const ticket = await ticketService.createTicket({
      user: USER,
      titulo: TICKET.titulo,
      descripcion: TICKET.descripcion,
      categoria: "incidencia",
      files: [fichero],
    });
    expect(ticket.attachmentWarnings).toBeUndefined();
  });

  it("si la fila del adjunto no entra, el fichero huérfano se limpia y también se avisa", async () => {
    respond = ({ table, op }) => {
      if (table === "support_ticket_attachments" && op === "insert") {
        return { data: null, error: { message: "constraint" } };
      }
      if (table === "support_tickets" && op === "select") return { data: TICKET, error: null };
      return { data: [], error: null };
    };
    const ticket = await ticketService.createTicket({
      user: USER,
      titulo: TICKET.titulo,
      descripcion: TICKET.descripcion,
      categoria: "incidencia",
      files: [fichero],
    });
    expect(ticket.attachmentWarnings).toEqual(["captura.png"]);
    expect(borrados).toHaveLength(1);
  });
});
