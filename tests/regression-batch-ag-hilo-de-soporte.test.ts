import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string; payload?: Record<string, unknown> };

let respond: (ctx: Call) => QueryResult;
let calls: Call[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://x/y" }, error: null }),
      }),
    },
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const finish = () => {
        calls.push({ ...state });
        return respond(state);
      };
      const q = {
        select: () => q,
        update: (payload: Record<string, unknown>) => {
          state.op = "update";
          state.payload = payload;
          return q;
        },
        insert: () => ((state.op = "insert"), q),
        eq: () => q,
        in: () => q,
        is: () => q,
        order: () => q,
        maybeSingle: async () => finish(),
        single: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { ticketService } from "@/server/services/supabase-tickets";
import type { SessionUser } from "@/lib/types";

const ADMIN: SessionUser = {
  id: "u1",
  nombre: "Ana Delegada",
  iniciales: "AD",
  email: "ana@aep.test",
  rol: "Delegado de Jueces",
  role: "delegado_jueces",
  zona: "CENTRO",
};

const TICKET_ROW = {
  id: "tick-1",
  titulo: "No carga la tarima",
  descripcion: "Se queda en blanco al abrir el campeonato",
  categoria: "incidencia",
  status: "resuelto",
  created_by_id: "u9",
  created_by_name: "Luis Juez",
  resolution_note: "Era un fallo de sesión, ya corregido",
  resolved_by: "Ana Delegada",
  resolved_at: "2026-03-01T10:00:00.000Z",
  created_at: "2026-02-01T10:00:00.000Z",
  updated_at: "2026-03-01T10:00:00.000Z",
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
});

describe("un hilo de soporte no se presenta vacío por un fallo de lectura", () => {
  it("el detalle falla en alto en vez de mostrar un ticket sin comentarios", async () => {
    respond = ({ table }) => {
      if (table === "support_tickets") return { data: TICKET_ROW, error: null };
      if (table === "support_ticket_comments") {
        return { data: null, error: { message: "connection reset" } };
      }
      return { data: [], error: null };
    };
    // Antes: el hilo salía vacío. Quien atiende contestaba sin ver lo dicho y
    // quien lo abrió creía que su comentario se había perdido.
    await expect(ticketService.getTicket("tick-1", ADMIN)).rejects.toThrow(/connection reset/);
  });

  it("el listado no pone «0 comentarios» cuando no ha podido contarlos", async () => {
    respond = ({ table }) => {
      if (table === "support_tickets") return { data: [TICKET_ROW], error: null };
      if (table === "support_ticket_comments") {
        return { data: null, error: { message: "connection reset" } };
      }
      return { data: [], error: null };
    };
    await expect(ticketService.getTickets({ user: ADMIN })).rejects.toThrow(/connection reset/);
  });

  it("la tabla aún sin migrar sigue devolviendo lista vacía, no error", async () => {
    respond = () => ({ data: null, error: { code: "42P01", message: "does not exist" } });
    await expect(ticketService.getTickets({ user: ADMIN })).resolves.toEqual([]);
  });
});

describe("resolver un ticket reabierto", () => {
  it("sin nota nueva no resucita la nota de la resolución anterior", async () => {
    respond = ({ table, op }) => {
      if (table === "support_tickets" && op === "select") {
        return { data: TICKET_ROW, error: null };
      }
      return { data: [], error: null };
    };

    await ticketService.updateTicketStatus({
      user: ADMIN,
      ticketId: "tick-1",
      status: "resuelto",
    });

    const patch = calls.find((c) => c.op === "update")?.payload ?? {};
    expect(patch).toMatchObject({ status: "resuelto", resolution_note: null });
  });

  it("con nota nueva se guarda la nota nueva", async () => {
    respond = ({ table, op }) => {
      if (table === "support_tickets" && op === "select") {
        return { data: TICKET_ROW, error: null };
      }
      return { data: [], error: null };
    };

    await ticketService.updateTicketStatus({
      user: ADMIN,
      ticketId: "tick-1",
      status: "resuelto",
      resolutionNote: "Ahora sí: faltaba la migración 035",
    });

    const patch = calls.find((c) => c.op === "update")?.payload ?? {};
    expect(patch.resolution_note).toBe("Ahora sí: faltaba la migración 035");
  });
});
