import { beforeEach, describe, expect, it, vi } from "vitest";

// Ronda del recorrido de flujos: quedaban lecturas que devolvían «no hay nada»
// cuando la base de datos fallaba. Con service-role, un error de lectura no es
// una lista vacía: es un dato desconocido, y presentarlo como vacío lleva a
// decisiones equivocadas (o, en compensación, a escribir encima del dinero).

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

let respond: (ctx: { table: string; op: string }) => QueryResult;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = { table, op: "select" };
      const finish = () => respond(state);
      const q = {
        select: () => q,
        update: () => ((state.op = "update"), q),
        delete: () => ((state.op = "delete"), q),
        insert: () => ((state.op = "insert"), q),
        upsert: () => ((state.op = "upsert"), q),
        eq: () => q,
        neq: () => q,
        in: () => q,
        gte: () => q,
        lte: () => q,
        lt: () => q,
        gt: () => q,
        is: () => q,
        or: () => q,
        ilike: () => q,
        limit: () => q,
        order: () => q,
        single: async () => finish(),
        maybeSingle: async () => finish(),
        range: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { refereeService } from "@/server/services/supabase-referees";
import { competitionService } from "@/server/services/supabase-competitions";
import { listRefereeSanctions } from "@/server/services/referee-sanctions";
import { examsService } from "@/server/services/supabase-exams";
import { compensationService } from "@/server/services/supabase-compensation";

const boom = { data: null, error: { message: "connection reset" } };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  respond = () => boom;
});

describe("una lectura que falla ya no se presenta como una lista vacía", () => {
  it("el censo de jueces no se queda en blanco en silencio", async () => {
    await expect(refereeService.getReferees()).rejects.toThrow(/referees/);
  });

  it("los jueces por id no desaparecen del resumen de compensación", async () => {
    await expect(refereeService.getRefereesByIds(["j1", "j2"])).rejects.toThrow(/referees/);
  });

  it("las sanciones de un juez no lo dejan como limpio", async () => {
    await expect(listRefereeSanctions("j1")).rejects.toThrow(/referee_sanctions/);
  });

  it("el desplegable de campeonatos no se vacía", async () => {
    await expect(competitionService.getCompetitionOptions()).rejects.toThrow(/competitions/);
  });

  it("la disponibilidad confirmada no se lee como «nadie ha confirmado»", async () => {
    await expect(competitionService.getCompetitionAvailability("c1")).rejects.toThrow(
      /competition_availability/,
    );
  });

  it("los exámenes y los informes no salen como inexistentes", async () => {
    await expect(examsService.getExams()).rejects.toThrow(/referee_exams/);
    await expect(examsService.getReports()).rejects.toThrow(/referee_reports/);
  });
});

describe("cuando la lectura va bien se sigue devolviendo la lista", () => {
  it("sin filas, lista vacía; no error", async () => {
    respond = () => ({ data: [], error: null });
    await expect(refereeService.getReferees()).resolves.toEqual([]);
    await expect(competitionService.getCompetitionAvailability("c1")).resolves.toEqual([]);
    await expect(listRefereeSanctions("j1")).resolves.toEqual([]);
  });
});

describe("las liquidaciones guardadas no se dan por inexistentes", () => {
  it("un fallo al leerlas corta el resumen en vez de reconstruirlo desde cero", async () => {
    // El resto de lecturas va bien: solo falla la tabla de liquidaciones.
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return boom;
      if (table === "competitions") {
        return {
          data: {
            id: "c1",
            nombre: "Copa de prueba",
            tipo: "AEP-2",
            fecha: "2026-03-21",
            fecha_fin: "2026-03-22",
            sede: "Madrid",
            zona: "CENTRO",
            sesiones: 1,
            requeridos: 1,
            confirmados: 0,
            estado: "Borrador",
            aprobacion: "Pendiente",
            template: [],
          },
          error: null,
        };
      }
      return { data: [], error: null };
    };
    // Antes devolvía un resumen «limpio» y `recalculate` lo persistía encima de
    // las liquidaciones reales, borrando km, overrides y los pagos marcados.
    await expect(compensationService.getSummary("c1")).rejects.toThrow(
      /judge_compensation_claims/,
    );
  });
});

describe("revisar un ascenso ya no puede degradar a un juez", () => {
  const solicitud = {
    id: "pr1",
    status: "pendiente",
    referee_id: "j1",
    to_level: "Nacional",
    zona: "CENTRO",
  };

  it("si no se puede leer el nivel actual, la solicitud sigue pendiente", async () => {
    const writes: string[] = [];
    respond = ({ table, op }) => {
      if (op !== "select") {
        writes.push(`${table}.${op}`);
        return { data: [{ id: "pr1" }], error: null };
      }
      if (table === "promotion_requests") return { data: solicitud, error: null };
      return boom; // la lectura del juez falla
    };
    await expect(examsService.reviewPromotion("pr1", true, "Nacional")).rejects.toThrow(
      /referees/,
    );
    // Nada se marcó ni se escribió: se puede reintentar.
    expect(writes).toEqual([]);
  });

  it("si el juez ya no está en el censo, tampoco se aprueba", async () => {
    const writes: string[] = [];
    respond = ({ table, op }) => {
      if (op !== "select") {
        writes.push(`${table}.${op}`);
        return { data: [{ id: "pr1" }], error: null };
      }
      if (table === "promotion_requests") return { data: solicitud, error: null };
      return { data: null, error: null };
    };
    await expect(examsService.reviewPromotion("pr1", true, "Nacional")).rejects.toThrow(
      /ya no existe en el censo/,
    );
    expect(writes).toEqual([]);
  });

  it("un ascenso que ya no es subida no toca el nivel del juez", async () => {
    const writes: string[] = [];
    respond = ({ table, op }) => {
      if (op !== "select") {
        writes.push(`${table}.${op}`);
        return { data: [{ id: "pr1" }], error: null };
      }
      if (table === "promotion_requests") return { data: { ...solicitud, status: "pendiente" }, error: null };
      // El juez ya es IPF Cat. 1: aprobar «Nacional» ahora sería degradarlo.
      return { data: { nivel: "IPF Cat. 1" }, error: null };
    };
    await examsService.reviewPromotion("pr1", true, "Nacional");
    expect(writes).toContain("promotion_requests.update");
    expect(writes).not.toContain("referees.update");
  });

  it("un ascenso legítimo sí actualiza el nivel", async () => {
    const writes: string[] = [];
    respond = ({ table, op }) => {
      if (op !== "select") {
        writes.push(`${table}.${op}`);
        return { data: [{ id: "pr1" }], error: null };
      }
      if (table === "promotion_requests") return { data: solicitud, error: null };
      return { data: { nivel: "Regional" }, error: null };
    };
    await examsService.reviewPromotion("pr1", true, "Nacional");
    expect(writes).toContain("referees.update");
  });
});
