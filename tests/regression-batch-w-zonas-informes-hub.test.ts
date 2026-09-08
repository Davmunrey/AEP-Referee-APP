import { beforeEach, describe, expect, it, vi } from "vitest";
import { zonesMatch } from "@/lib/aep-zones";

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
        range: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { examsService } from "@/server/services/supabase-exams";
import { competitionService } from "@/server/services/supabase-competitions";

const delegado = { id: "u1", nombre: "D", role: "delegado_zona", zona: "CENTRO" } as const;

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
      id: "u2",
      nombre: "N",
      role: "super_admin",
    } as never);
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
