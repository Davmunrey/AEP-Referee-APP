import { beforeEach, describe, expect, it, vi } from "vitest";
import { zonesMatch } from "@/lib/aep-zones";
import type { SessionUser } from "@/lib/types";

describe("zonesMatch", () => {
  it("reconoce alias y códigos anteriores a la migración 013", () => {
    expect(zonesMatch("CENTRO", "MAD")).toBe(true);
    expect(zonesMatch("2- CENTRO", "CENTRO")).toBe(true);
    expect(zonesMatch("Centro", "CENTRO")).toBe(true);
    expect(zonesMatch("NOROESTE", "GAL")).toBe(true);
  });

  it("no confunde zonas distintas ni acepta vacíos", () => {
    expect(zonesMatch("CENTRO", "ANDALUCIA")).toBe(false);
    expect(zonesMatch("", "CENTRO")).toBe(false);
    expect(zonesMatch(null, null)).toBe(false);
    expect(zonesMatch("CENTRO", undefined)).toBe(false);
  });

  it("dos códigos desconocidos solo casan si son literalmente el mismo", () => {
    expect(zonesMatch("ZZZ", "ZZZ")).toBe(true);
    expect(zonesMatch("ZZZ", "YYY")).toBe(false);
  });
});

// ── Capa Supabase ───────────────────────────────────────────────────────────
type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

let respond: (ctx: { table: string; op: string; filters: [string, unknown][] }) => QueryResult;
let calls: { table: string; op: string; filters: [string, unknown][] }[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = { table, op: "select", filters: [] as [string, unknown][] };
      const finish = () => {
        calls.push({ ...state, filters: [...state.filters] });
        return respond(state);
      };
      const q = {
        select: () => q,
        update: () => ((state.op = "update"), q),
        insert: () => ((state.op = "insert"), q),
        delete: () => ((state.op = "delete"), q),
        eq: (c: string, v: unknown) => (state.filters.push([c, v]), q),
        neq: () => q,
        in: (c: string, v: unknown) => (state.filters.push([c, v]), q),
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
        range: async (from: number, to: number) => {
          state.filters.push(["__range", `${from}-${to}`]);
          return finish();
        },
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { examsService } from "@/server/services/supabase-exams";
import { competitionService } from "@/server/services/supabase-competitions";

const delegado: SessionUser = {
  id: "u1",
  nombre: "Delegado",
  rol: "Delegado de zona",
  iniciales: "DZ",
  email: "delegado@example.org",
  role: "delegado_zona",
  zona: "CENTRO",
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
});

describe("informes: la zona es texto libre, no se puede comparar en crudo", () => {
  const informes = [
    { id: "r1", subject_type: "juez", zona: "MAD", titulo: "A", tipo: "Juez", contenido: "x", autor: "y" },
    { id: "r2", subject_type: "juez", zona: "CENTRO", titulo: "B", tipo: "Juez", contenido: "x", autor: "y" },
    { id: "r3", subject_type: "juez", zona: "ANDALUCIA", titulo: "C", tipo: "Juez", contenido: "x", autor: "y" },
  ];

  it("el delegado ve también los informes guardados con códigos anteriores", async () => {
    respond = () => ({ data: informes, error: null });
    const list = await examsService.getReports(undefined, delegado);
    // Antes: `.eq("zona", "CENTRO")` en SQL dejaba fuera «MAD», que es su misma zona.
    expect(list.map((r) => r.id)).toEqual(["r1", "r2"]);
    // Y el filtro ya no viaja como `.eq` de zona a la base de datos.
    const zonaFilters = calls.flatMap((c) => c.filters).filter(([col]) => col === "zona");
    expect(zonaFilters).toEqual([]);
  });

  it("un rol nacional los sigue viendo todos", async () => {
    respond = () => ({ data: informes, error: null });
    const list = await examsService.getReports(undefined, {
      ...delegado,
      id: "u2",
      role: "super_admin",
    });
    expect(list).toHaveLength(3);
  });
});

describe("exámenes: la zona del perfil se canonicaliza antes de buscar jueces", () => {
  it("un perfil con alias encuentra a los jueces de su zona", async () => {
    respond = ({ table }) =>
      table === "referees" ? { data: [{ id: "j1" }], error: null } : { data: [], error: null };
    await examsService.getExams(undefined, { ...delegado, zona: "2- CENTRO" });
    const zonaFilter = calls
      .filter((c) => c.table === "referees")
      .flatMap((c) => c.filters)
      .find(([col]) => col === "zona");
    // Antes viajaba «2- CENTRO» y no casaba con ningún juez → «no hay exámenes».
    expect(zonaFilter?.[1]).toBe("CENTRO");
  });
});

describe("la lista de campeonatos no se queda vacía en silencio", () => {
  it("un fallo de lectura se propaga en vez de dar «no hay campeonatos»", async () => {
    // Solo falla la tabla de campeonatos; las asignaciones se leen bien.
    respond = ({ table }) =>
      table === "competitions"
        ? { data: null, error: { message: "connection reset" } }
        : { data: [], error: null };
    await expect(competitionService.getCompetitions()).rejects.toThrow(/competitions/);
  });
});

// ── Hub de compensación ─────────────────────────────────────────────────────
import { buildHubSummary } from "@/lib/judge-compensation/hub";
import type { CompetitionCompensationSummary } from "@/lib/judge-compensation/types";
import type { Competition } from "@/lib/types";

const comp = (id: string, fecha: string): Competition =>
  ({
    id,
    nombre: `Evento ${id}`,
    fecha,
    fechaFin: fecha,
    sede: "Madrid",
    estado: "Completo",
    tipo: "AEP-1",
    zona: "CENTRO",
  }) as Competition;

const summary = (
  over: Partial<CompetitionCompensationSummary> & { ready?: boolean } = {},
): CompetitionCompensationSummary => ({
  competitionId: "c1",
  claims: [{ refereeId: "r1" } as CompetitionCompensationSummary["claims"][0]],
  grandTotal: over.grandTotal ?? 0,
  provisionalTotal: over.provisionalTotal ?? 0,
  readiness: {
    venueReady: true,
    allTravelResolved: true,
    pendingTravelReferees: [],
    missingDomicilioReferees: [],
    issues: [],
    readyForExport: over.ready ?? false,
  },
});

describe("el hub deja de esconder el dinero ya calculado", () => {
  it("agrega lo confirmado y lo provisional por separado", () => {
    const summaries = new Map<string, CompetitionCompensationSummary>([
      ["c1", summary({ ready: true, grandTotal: 300, provisionalTotal: 300 })],
      // Este espera km: su importe está calculado pero no es exportable.
      ["c2", summary({ ready: false, grandTotal: 0, provisionalTotal: 185.5 })],
    ]);
    const hub = buildHubSummary([comp("c1", "2026-03-01"), comp("c2", "2026-02-01")], summaries);

    expect(hub.confirmedTotal).toBe(300);
    expect(hub.provisionalTotal).toBe(485.5);
    expect(hub.readyCount).toBe(1);
    // La fila del que espera km ya no llega con el importe perdido: antes la
    // tabla pintaba «—» aunque el importe estuviera calculado.
    expect(hub.items.find((i) => i.competitionId === "c2")?.provisionalTotal).toBe(185.5);
  });

  it("no arrastra colas de céntimo al sumar", () => {
    const summaries = new Map<string, CompetitionCompensationSummary>([
      ["c1", summary({ ready: true, grandTotal: 0.1, provisionalTotal: 0.1 })],
      ["c2", summary({ ready: true, grandTotal: 0.2, provisionalTotal: 0.2 })],
    ]);
    const hub = buildHubSummary([comp("c1", "2026-03-01"), comp("c2", "2026-02-01")], summaries);
    expect(hub.confirmedTotal).toBe(0.3);
  });
});

describe("los informes no se cortan en la fila 1000", () => {
  it("pagina hasta agotar las filas", async () => {
    // El filtro por zona no puede ir en SQL (columna de texto libre), así que
    // sin paginar el corte de PostgREST descartaba en silencio lo que viniera
    // después de la primera página.
    const page = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `r${offset + i}`,
        subject_type: "juez",
        zona: "CENTRO",
        titulo: "T",
        tipo: "Juez",
        contenido: "x",
        autor: "y",
      }));
    let call = 0;
    respond = () => ({ data: call++ === 0 ? page(1000, 0) : page(7, 1000), error: null });

    const list = await examsService.getReports(undefined, delegado);
    expect(list).toHaveLength(1007);
    const ranges = calls.flatMap((c) => c.filters).filter(([col]) => col === "__range");
    expect(ranges.map(([, v]) => v)).toEqual(["0-999", "1000-1999"]);
  });
});
