import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RosterSession, SessionUser } from "@/lib/types";
import { addDaysIso, todayIso } from "@/lib/business-date";

// Rendimiento de la analítica y del panel sin cambiar lo que enseñan:
// - `loadAllAssignments` pide las páginas en paralelo cuando conoce el total,
//   y sigue en serie (como siempre) cuando no lo conoce.
// - La analítica lee `competitions` UNA vez (antes `select("*")` + otra
//   lectura entera solo por la plantilla), recorre roster_assignments una vez
//   (antes dos en un route handler, tres en la exportación) y el cruce
//   cross-zona deja de ser una etapa aparte que releía todo el año.
// - El panel lee la última captura de salud y las alertas de sanción en la
//   primera tanda, registra la captura nueva al terminar la respuesta, y solo
//   pide las aprobaciones/ascensos pendientes.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

type Row = Record<string, unknown>;
type Call = {
  table: string;
  op: "select" | "insert" | "update";
  select?: string;
  count?: string;
  eqs: [string, unknown][];
  ins: [string, unknown[]][];
  orders: string[];
  range?: [number, number];
  seq: number;
};

let tables: Record<string, Row[]>;
let calls: Call[];
let seq: number;
let inflight: number;
let maxInflight: number;
/** Fuerza un error en la llamada a `.range()` número N de roster_assignments. */
let failAssignmentsRangeAt: number | null;
let failTable: string | null;
/** El doble de PostgREST devuelve `count` solo si se pidió (como el real). */
let omitCount: boolean;
/** Se llama tras resolver cada `.range()` (para simular escrituras entre páginas). */
let afterRange: ((table: string) => void) | null;

function query(table: string) {
  const call: Call = { table, op: "select", eqs: [], ins: [], orders: [], seq: seq++ };
  calls.push(call);
  const filtered = () =>
    (tables[table] ?? []).filter(
      (r) =>
        call.eqs.every(([c, v]) => r[c] === v) &&
        call.ins.every(([c, vs]) => vs.includes(r[c])),
    );
  const sorted = () =>
    [...filtered()].sort((a, b) => {
      for (const col of call.orders) {
        const x = String(a[col] ?? "");
        const y = String(b[col] ?? "");
        if (x !== y) return x < y ? -1 : 1;
      }
      return 0;
    });
  // Incrustación de PostgREST (`*, roster_assignments(slot_key, referee_id)`):
  // `getCompetitions` trae así las asignaciones de cada campeonato.
  const embed = (rows: Row[]) =>
    table === "competitions" && call.select?.includes("roster_assignments(")
      ? rows.map((r) => ({
          ...r,
          roster_assignments: (tables.roster_assignments ?? []).filter((a) => a.competition_id === r.id),
        }))
      : rows;
  const result = () => {
    if (failTable === table) return { data: null, error: { message: "connection reset" } };
    return { data: embed(sorted()), error: null };
  };
  const q: Record<string, unknown> = {};
  q.select = (cols?: string, opts?: { count?: string }) => {
    call.select = cols;
    call.count = opts?.count;
    return q;
  };
  q.eq = (c: string, v: unknown) => (call.eqs.push([c, v]), q);
  q.in = (c: string, v: unknown[]) => (call.ins.push([c, v]), q);
  for (const m of ["gte", "lte", "lt", "gt", "neq", "is", "or", "not", "limit", "ilike", "contains"]) q[m] = () => q;
  q.order = (c: string) => (call.orders.push(c), q);
  q.insert = (row: Row) => {
    call.op = "insert";
    (tables[table] ??= []).push(row);
    return q;
  };
  q.update = () => ((call.op = "update"), q);
  q.range = async (from: number, to: number) => {
    call.range = [from, to];
    const ordinal = calls.filter((c) => c.table === table && c.range).length;
    inflight += 1;
    maxInflight = Math.max(maxInflight, inflight);
    // Un macrotask: así se ve si las páginas se pidieron a la vez o en serie.
    await new Promise((r) => setTimeout(r, 0));
    inflight -= 1;
    if (table === "roster_assignments" && ordinal === failAssignmentsRangeAt) {
      return { data: null, error: { message: "network" } };
    }
    const res = result();
    afterRange?.(table);
    if (res.error) return res;
    const page = res.data.slice(from, to + 1);
    return call.count && !omitCount
      ? { data: page, error: null, count: res.data.length }
      : { data: page, error: null };
  };
  q.maybeSingle = async () => {
    const res = result();
    return res.error ? res : { data: res.data[0] ?? null, error: null };
  };
  q.single = q.maybeSingle;
  q.then = (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: query }),
}));

// `unstable_cache` exige el incrementalCache de Next; aquí se lee directo.
vi.mock("@/server/cache/static-data", () => ({
  getZonesCached: async () => tables.zones ?? [],
  getRegulationsCached: async () => [],
}));

const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getAnalytics: vi.fn(),
    getCompetitions: vi.fn(),
    getAnalyticsWithCompetitions: vi.fn(),
  },
}));

import { loadAllAssignments } from "@/server/services/supabase-helpers";
import { analyticsService } from "@/server/services/supabase-analytics";
import { competitionService } from "@/server/services/supabase-competitions";
import { dataService } from "@/server/services";
import { GET as exportGet } from "@/app/api/v1/analytics/export/route";

const admin: SessionUser = {
  id: "u1",
  nombre: "Admin",
  rol: "Super admin",
  iniciales: "SA",
  email: "admin@example.org",
  role: "super_admin",
};
const delegado = (zona: string | undefined): SessionUser => ({
  id: "u2",
  nombre: "Delegado",
  rol: "Delegado de zona",
  iniciales: "DZ",
  email: "dz@example.org",
  role: "delegado_zona",
  zona,
});

const template: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "",
    categorias: [],
    horarioCompeticion: "",
    horarioPesaje: "",
    roles: [{ rol: "Juez central", key: "central", slots: 2 }],
    pesajeRoles: [],
  },
];

const comp = (id: string, fecha: string, zona: string): Row => ({
  id,
  nombre: `Open ${id}`,
  tipo: "AEP-3",
  fecha,
  fecha_fin: fecha,
  sede: "X",
  sesiones: 1,
  requeridos: 9,
  confirmados: 0,
  estado: "Borrador",
  aprobacion: "Sin propuesta",
  zona,
  template,
});

const assignment = (competition_id: string, n: number, cross_zone = false): Row => ({
  competition_id,
  slot_key: `S1_central_${n}`,
  referee_id: `r-${competition_id}-${n}`,
  cross_zone,
});

beforeEach(() => {
  calls = [];
  seq = 0;
  inflight = 0;
  maxInflight = 0;
  failAssignmentsRangeAt = null;
  failTable = null;
  omitCount = false;
  afterRange = null;
  tables = { zones: [{ code: "CENTRO", name: "2- CENTRO" }, { code: "ANDALUCIA", name: "4- ANDALUCIA" }] };
});

const pad = (i: number) => String(i).padStart(6, "0");
const syntheticAssignments = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    competition_id: `c${pad(Math.floor(i / 40))}`,
    slot_key: `S1_central_${pad(i)}`,
    referee_id: `r${i}`,
  }));
const assignmentRanges = () =>
  calls.filter((c) => c.table === "roster_assignments" && c.range).map((c) => c.range!);
const totalAssigned = (m: Map<string, Record<string, string>>) =>
  [...m.values()].reduce((n, a) => n + Object.keys(a).length, 0);

describe("loadAllAssignments en paralelo cuando conoce el total", () => {
  it("pide el total en la primera página y el resto a la vez", async () => {
    tables.roster_assignments = syntheticAssignments(4500);
    const mapa = await loadAllAssignments();
    expect(totalAssigned(mapa)).toBe(4500);
    const first = calls.find((c) => c.table === "roster_assignments")!;
    expect(first.count).toBe("exact");
    // Mismo orden de clave primaria en todas las páginas: paginado total.
    for (const c of calls.filter((x) => x.table === "roster_assignments")) {
      expect(c.orders).toEqual(["competition_id", "slot_key"]);
    }
    expect(assignmentRanges()).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [3000, 3999],
      [4000, 4999],
    ]);
    // Antes: una petición en vuelo cada vez.
    expect(maxInflight).toBe(4);
  });

  it("acota las peticiones simultáneas", async () => {
    tables.roster_assignments = syntheticAssignments(15_500);
    const mapa = await loadAllAssignments();
    expect(totalAssigned(mapa)).toBe(15_500);
    expect(maxInflight).toBeLessThanOrEqual(6);
    expect(assignmentRanges()).toHaveLength(16);
  });

  it("con un total múltiplo exacto de mil sigue preguntando hasta una página corta", async () => {
    tables.roster_assignments = syntheticAssignments(3000);
    const mapa = await loadAllAssignments();
    expect(totalAssigned(mapa)).toBe(3000);
    expect(assignmentRanges().map((r) => r[0])).toEqual([0, 1000, 2000, 3000]);
  });

  it("filas insertadas después del recuento no se pierden", async () => {
    tables.roster_assignments = syntheticAssignments(2000);
    // La primera página cuenta 2000; antes de las siguientes llegan 500 más.
    afterRange = (table) => {
      if (table !== "roster_assignments" || tables.roster_assignments!.length > 2000) return;
      tables.roster_assignments = syntheticAssignments(2500);
    };
    const mapa = await loadAllAssignments();
    expect(totalAssigned(mapa)).toBe(2500);
    expect(assignmentRanges().map((r) => r[0])).toEqual([0, 1000, 2000]);
  });

  it("sin total sigue en serie, como antes", async () => {
    omitCount = true;
    tables.roster_assignments = syntheticAssignments(2500);
    const mapa = await loadAllAssignments();
    expect(totalAssigned(mapa)).toBe(2500);
    expect(maxInflight).toBe(1);
    expect(assignmentRanges().map((r) => r[0])).toEqual([0, 1000, 2000]);
  });

  it("un error en una página paralela se propaga en vez de devolver un mapa corto", async () => {
    tables.roster_assignments = syntheticAssignments(4500);
    failAssignmentsRangeAt = 3;
    await expect(loadAllAssignments()).rejects.toThrow(/roster_assignments/);
  });
});

describe("analítica: una sola carga", () => {
  beforeEach(() => {
    tables.competitions = [
      comp("a25", "2025-05-01", "CENTRO"),
      comp("a26", "2026-03-01", "CENTRO"),
      comp("b26", "2026-04-01", "ANDALUCIA"),
    ];
    tables.roster_assignments = [
      assignment("a25", 0, true), // otro año: no cuenta en 2026
      assignment("a26", 0, true),
      assignment("a26", 1),
      assignment("b26", 0, true),
      assignment("b26", 1, true),
    ];
    tables.referees = [];
    tables.approval_proposals = [];
  });

  it("lee competitions y roster_assignments una vez cada una", async () => {
    const res = await analyticsService.getAnalytics(admin, 2026);
    const compReads = calls.filter((c) => c.table === "competitions");
    expect(compReads).toHaveLength(1);
    expect(compReads[0]!.select).toBe("*");
    expect(compReads[0]!.orders).toEqual(["fecha", "id"]);
    const fullPasses = calls.filter(
      (c) => c.table === "roster_assignments" && !c.eqs.some(([col]) => col === "cross_zone"),
    );
    // Antes: getCompetitions y la analítica la recorrían cada una por su lado
    // (fuera de un render RSC `cache()` no deduplica).
    expect(fullPasses).toHaveLength(1);
    // El cruce va filtrado en SQL, sin `.in()` por año, ordenado por la PK.
    const cross = calls.filter((c) => c.table === "roster_assignments" && c !== fullPasses[0]);
    expect(cross).toHaveLength(1);
    expect(cross[0]!.eqs).toEqual([["cross_zone", true]]);
    expect(cross[0]!.ins).toEqual([]);
    expect(cross[0]!.orders).toEqual(["competition_id", "slot_key"]);
    // Y en la misma tanda que el resto, no en una etapa posterior.
    expect(cross[0]!.seq).toBeLessThan(calls.find((c) => c.table === "referees")!.seq);

    expect(res.crossZoneSummary?.totalCrossZoneSlots).toBe(3);
    expect(res.activityByZone.find((z) => z.zona === "CENTRO")?.crossZoneSlots).toBe(1);
    expect(res.activityByZone.find((z) => z.zona === "ANDALUCIA")?.crossZoneSlots).toBe(2);
    // La plantilla sale de la misma lectura: 2 plazas por campeonato.
    expect(res.totals).toMatchObject({ competitions: 2, filledSlots: 4, openSlots: 0 });
    expect(res.availableYears).toEqual([2025, 2026]);
  });

  it("la lista que devuelve es la misma que getCompetitions(user)", async () => {
    for (const user of [admin, delegado("CENTRO"), delegado("Zona Inventada")]) {
      const { competitions } = await analyticsService.getAnalyticsWithCompetitions(user, 2026);
      expect(competitions).toEqual(await competitionService.getCompetitions(user));
    }
  });

  it("el delegado solo cuenta su zona, y con zona ilegible no ve nada", async () => {
    const centro = await analyticsService.getAnalytics(delegado("CENTRO"), 2026);
    expect(centro.totals.competitions).toBe(1);
    expect(centro.crossZoneSummary?.totalCrossZoneSlots).toBe(1);
    expect(centro.activityByZone.find((z) => z.zona === "ANDALUCIA")?.crossZoneSlots).toBe(0);

    const ilegible = await analyticsService.getAnalytics(delegado("Zona Inventada"), 2026);
    expect(ilegible.totals.competitions).toBe(0);
    expect(ilegible.crossZoneSummary?.totalCrossZoneSlots).toBe(0);
  });

  it("un fallo del cruce cross-zona sigue tumbando la analítica", async () => {
    // El primer `.range()` de roster_assignments es el de la carga completa o
    // el del cruce según el orden de la tanda; cualquiera de los dos propaga.
    failAssignmentsRangeAt = 2;
    await expect(analyticsService.getAnalytics(admin, 2026)).rejects.toThrow(/roster_assignments/);
  });
});

describe("panel: salud y sanciones en la primera tanda", () => {
  const futuro = addDaysIso(todayIso(), 30);
  beforeEach(() => {
    tables.competitions = [comp("f1", futuro, "CENTRO")];
    tables.roster_assignments = [assignment("f1", 0)];
    tables.referees = [];
    tables.activity_log = [];
    tables.referee_sanctions = [];
    tables.approval_proposals = [
      { id: "p1", status: "pendiente", zona: "CENTRO" },
      { id: "p2", status: "aprobado", zona: "CENTRO" },
      { id: "p3", status: "rechazado", zona: "CENTRO" },
    ];
    tables.promotion_requests = [
      { id: "q1", status: "pendiente", zona: "CENTRO" },
      { id: "q2", status: "aprobado", zona: "CENTRO" },
    ];
  });

  it("lee la captura de salud y las alertas antes de la etapa de asignaciones", async () => {
    const haceUnDia = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    tables.health_snapshots = [{ score: 40, captured_at: haceUnDia }];
    const res = await analyticsService.getDashboard(admin);
    const firstAssignments = calls.find((c) => c.table === "roster_assignments")!.seq;
    const healthRead = calls.find((c) => c.table === "health_snapshots" && c.op === "select")!;
    const alerts = calls.find(
      (c) => c.table === "referee_sanctions" && c.eqs.some(([col, v]) => col === "status" && v === "activa"),
    )!;
    expect(healthRead.seq).toBeLessThan(firstAssignments);
    expect(alerts.seq).toBeLessThan(firstAssignments);
    // El delta se calcula igual que antes.
    expect(res.health.previousScore).toBe(40);
    expect(res.health.delta).toBe(res.health.score - 40);
    // La captura nueva (más de seis horas) se registra al terminar la respuesta.
    await vi.waitFor(() => expect(tables.health_snapshots).toHaveLength(2));
    expect(tables.health_snapshots[1]).toMatchObject({ score: res.health.score, status: res.health.status });
  });

  it("con una captura reciente no registra otra", async () => {
    tables.health_snapshots = [{ score: 70, captured_at: new Date().toISOString() }];
    const res = await analyticsService.getDashboard(admin);
    expect(res.health.previousScore).toBe(70);
    await new Promise((r) => setTimeout(r, 5));
    expect(tables.health_snapshots).toHaveLength(1);
    expect(calls.some((c) => c.table === "health_snapshots" && c.op === "insert")).toBe(false);
  });

  it("si la tabla de salud falla, degrada sin delta y sin registrar", async () => {
    failTable = "health_snapshots";
    const res = await analyticsService.getDashboard(admin);
    expect(res.health.previousScore).toBeUndefined();
    await new Promise((r) => setTimeout(r, 5));
    expect(calls.some((c) => c.table === "health_snapshots" && c.op === "insert")).toBe(false);
  });

  it("un fallo de las alertas de sanción sigue tumbando el panel", async () => {
    tables.health_snapshots = [];
    failTable = "referee_sanctions";
    await expect(analyticsService.getDashboard(admin)).rejects.toThrow(/referee_sanctions/);
  });

  it("solo pide aprobaciones y ascensos pendientes, y el recuento no cambia", async () => {
    tables.health_snapshots = [];
    const res = await analyticsService.getDashboard(admin);
    for (const table of ["approval_proposals", "promotion_requests"]) {
      const c = calls.find((x) => x.table === table)!;
      expect(c.eqs).toEqual([["status", "pendiente"]]);
      expect(c.orders).toEqual(["id"]);
    }
    expect(res.kpis.find((k) => k.id === "approvals")?.value).toBe("1");
  });
});

describe("exportación CSV: una sola carga", () => {
  type Mock = ReturnType<typeof vi.fn>;
  beforeEach(() => {
    requireApiUser.mockReset();
    requireApiUser.mockResolvedValue(admin);
    for (const fn of Object.values(dataService)) (fn as unknown as Mock).mockReset();
  });

  it("no vuelve a pedir los campeonatos por separado", async () => {
    tables.competitions = [comp("a25", "2025-05-01", "CENTRO"), comp("a26", "2026-03-01", "CENTRO")];
    tables.roster_assignments = [assignment("a26", 0)];
    tables.referees = [];
    tables.approval_proposals = [];
    (dataService.getAnalyticsWithCompetitions as unknown as Mock).mockImplementation(
      analyticsService.getAnalyticsWithCompetitions,
    );
    const res = await exportGet(new Request("http://localhost/api/v1/analytics/export?year=2026"));
    expect(res.status).toBe(200);
    expect(dataService.getAnalyticsWithCompetitions).toHaveBeenCalledWith(admin, 2026);
    expect(dataService.getCompetitions).not.toHaveBeenCalled();
    expect(dataService.getAnalytics).not.toHaveBeenCalled();
    const body = await res.text();
    const section = body.split("CAMPEONATOS_AÑO_ACTIVO")[1]!.split("CAMPEONATOS_CRITICOS")[0]!;
    expect(section).toContain("Open a26");
    expect(section).not.toContain("Open a25");
    // Una pasada por competitions y otra por roster_assignments (más el cruce).
    expect(calls.filter((c) => c.table === "competitions")).toHaveLength(1);
    expect(
      calls.filter((c) => c.table === "roster_assignments" && !c.eqs.length),
    ).toHaveLength(1);
  });

  it("un fallo de carga sigue devolviendo error, no un CSV a medias", async () => {
    (dataService.getAnalyticsWithCompetitions as unknown as Mock).mockRejectedValue(new Error("boom"));
    const res = await exportGet(new Request("http://localhost/api/v1/analytics/export"));
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
