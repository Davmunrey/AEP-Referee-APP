import { describe, expect, it, vi } from "vitest";

// PostgREST corta en 1000 filas, así que todas las lecturas grandes de la
// aplicación paginan con OFFSET/LIMIT. Lo que faltaba es que ese paginado sea
// DETERMINISTA: `OFFSET`/`LIMIT` sobre una consulta sin orden total no
// garantiza nada entre página y página. Postgres devuelve las filas como le
// convenga, así que una escritura concurrente —o un plan distinto— hace que una
// fila salga dos veces y otra no salga ninguna.
//
// Comprobado contra un PostgreSQL 16 real antes de escribir esto: 2500 filas
// paginadas de mil en mil, con un UPDATE sobre las primeras entre la página 1 y
// la 2, devolvieron 2500 filas de las que 300 estaban repetidas y 300 no
// aparecieron nunca.
//
// El desempate es siempre la clave primaria. Estos tests fijan que ninguna
// consulta paginada se quede sin él.

/** Registra los `.order(columna, ...)` de cada consulta que llega a `.range()`. */
function clienteQueRegistra(ordenes: Map<string, string[][]>, filas: Record<string, unknown[]>) {
  const tablaActual = { nombre: "" };
  return {
    from(tabla: string) {
      tablaActual.nombre = tabla;
      const cols: string[] = [];
      const q: Record<string, unknown> = {};
      const encadenar = () => q;
      q.select = encadenar;
      q.insert = async () => ({ data: null, error: null });
      q.update = encadenar;
      q.upsert = async () => ({ data: null, error: null });
      q.delete = encadenar;
      q.eq = encadenar;
      q.is = encadenar;
      q.in = encadenar;
      q.limit = encadenar;
      q.not = encadenar;
      q.gte = encadenar;
      q.lte = encadenar;
      q.gt = encadenar;
      q.lt = encadenar;
      q.neq = encadenar;
      q.or = encadenar;
      q.filter = encadenar;
      q.contains = encadenar;
      q.maybeSingle = async () => ({ data: null, error: null });
      q.single = async () => ({ data: null, error: null });
      q.then = (
        resolver: (r: { data: unknown[]; error: null }) => unknown,
      ) => Promise.resolve({ data: (filas[tabla] ?? []).slice(0, 1000), error: null }).then(resolver);
      q.order = (col: string) => {
        cols.push(col);
        return q;
      };
      q.range = async (desde: number, hasta: number) => {
        const previas = ordenes.get(tabla) ?? [];
        previas.push([...cols]);
        ordenes.set(tabla, previas);
        return { data: (filas[tabla] ?? []).slice(desde, hasta + 1), error: null };
      };
      return q;
    },
  };
}

const ordenes = new Map<string, string[][]>();
const filas: Record<string, unknown[]> = {
  competitions: [],
  referees: [],
  approval_proposals: [],
  promotion_requests: [],
  activity_log: [],
  roster_assignments: [],
  support_tickets: [],
  support_ticket_comments: [],
  support_ticket_attachments: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => clienteQueRegistra(ordenes, filas),
}));

import { analyticsService } from "@/server/services/supabase-analytics";
import { ticketService } from "@/server/services/supabase-tickets";
import type { SessionUser } from "@/lib/types";

const admin: SessionUser = {
  id: "u-admin",
  nombre: "Admin",
  email: "admin@aep.test",
  role: "super_admin",
  rol: "Super Admin",
  iniciales: "AD",
};

describe("el paginado lleva siempre un desempate único", () => {
  it("el panel ordena por id sus cuatro lecturas paginadas", async () => {
    ordenes.clear();
    await analyticsService.getDashboard(admin);

    // Las cuatro tablas que el panel lee enteras.
    for (const tabla of ["competitions", "referees", "approval_proposals", "promotion_requests"]) {
      const porTabla = ordenes.get(tabla);
      expect(porTabla, `${tabla} no llegó a paginarse`).toBeDefined();
      for (const cols of porTabla!) {
        expect(cols, `${tabla} pagina sin desempate único: ordena por [${cols.join(", ")}]`)
          .toContain("id");
      }
    }
  });

  it("el panel conserva el orden por fecha, con id solo como desempate", async () => {
    ordenes.clear();
    await analyticsService.getDashboard(admin);
    // `fecha` primero: el orden que se ve en pantalla no cambia.
    expect(ordenes.get("competitions")![0]).toEqual(["fecha", "id"]);
  });

  it("la bandeja de tickets desempata por id, que updated_at se reescribe al comentar", async () => {
    ordenes.clear();
    await ticketService.getTickets({ user: admin });
    const cols = ordenes.get("support_tickets")![0]!;
    expect(cols[0]).toBe("updated_at");
    expect(cols).toContain("id");
  });
});
