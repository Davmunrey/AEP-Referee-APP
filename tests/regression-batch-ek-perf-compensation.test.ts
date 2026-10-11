import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Competition, SessionUser } from "@/lib/types";

// Rendimiento de compensación sin cambiar lo que se ve ni lo que se guarda.
//
// - El resumen de un campeonato eran cuatro viajes en fila a la base (y la
//   fila del campeonato y sus asignaciones se leían dos veces cada una).
// - Cada edición de una liquidación —un km, una casilla— eran cinco viajes en
//   fila antes de escribir, con los conceptos leídos y tirados.
// - El hub descargaba todos los conceptos del histórico sin usarlos y releía
//   la plantilla de campeonatos sin jueces.
// - La pantalla del tablero se hidrataba vacía y pedía el resumen a la API.
//
// Estas pruebas fijan las dos cosas: el resultado es el mismo, y los viajes
// son menos.

type Row = Record<string, unknown>;
type Call = {
  table: string;
  op: string;
  columns: string;
  eq: [string, unknown][];
  inFilter: [string, unknown[]] | null;
  depth: number;
};

const tables: Record<string, Row[]> = {};
const failures: Record<string, string> = {};
let calls: Call[];
// Profundidad de la cadena de viajes: una consulta lanzada tras resolverse
// otra de profundidad n tiene profundidad n + 1. Las que van en el mismo
// `Promise.all` comparten profundidad.
let depth = 0;
let staleUpdate = false;

function query(table: string) {
  const state: Call = { table, op: "select", columns: "*", eq: [], inFilter: null, depth };
  let from: number | null = null;
  let to: number | null = null;
  const run = (mode: "list" | "single" | "maybe") => {
    calls.push({ ...state, eq: [...state.eq], depth: state.depth });
    const myDepth = state.depth;
    return new Promise((resolve) =>
      setTimeout(() => {
        depth = myDepth + 1;
        const fail = failures[table];
        if (fail && state.op === "select" && state.columns !== "travel_amount_override") {
          resolve({ data: null, error: { code: "XX000", message: fail } });
          return;
        }
        if (state.op === "update") {
          if (staleUpdate) {
            resolve({ data: [], error: null });
            return;
          }
          const hit = (tables[table] ?? []).filter((r) => state.eq.every(([c, v]) => r[c] === v));
          resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
          return;
        }
        if (state.op !== "select") {
          resolve({ data: [], error: null });
          return;
        }
        let hit = (tables[table] ?? []).filter(
          (r) =>
            state.eq.every(([c, v]) => r[c] === v) &&
            (!state.inFilter || state.inFilter[1].includes(r[state.inFilter[0]])),
        );
        if (from != null && to != null) hit = hit.slice(from, to + 1);
        if (mode === "list") resolve({ data: hit, error: null });
        else if (hit[0]) resolve({ data: hit[0], error: null });
        else if (mode === "single") {
          resolve({ data: null, error: { code: "PGRST116", message: "0 rows" } });
        } else resolve({ data: null, error: null });
      }, 0),
    );
  };
  const q: Record<string, unknown> = {
    select: (cols?: string) => {
      if (state.op === "select") state.columns = cols ?? "*";
      return q;
    },
    update: () => ((state.op = "update"), q),
    insert: () => ((state.op = "insert"), q),
    upsert: () => ((state.op = "upsert"), q),
    delete: () => ((state.op = "delete"), q),
    eq: (c: string, v: unknown) => (state.eq.push([c, v]), q),
    in: (c: string, v: unknown[]) => ((state.inFilter = [c, v]), q),
    order: () => q,
    limit: () => q,
    range: (f: number, t: number) => ((from = f), (to = t), run("list")),
    single: () => run("single"),
    maybeSingle: () => run("maybe"),
    then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      run("list").then(resolve, reject),
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: query }),
}));

// Rutas: el servicio de datos y la sesión de la API, simulados.
const ds = {
  getCompetition: vi.fn(),
  getRoster: vi.fn(),
  getReferee: vi.fn(),
  getCompensationSummary: vi.fn(),
  getCompensationClaimForExport: vi.fn(),
};
const requireApiUser = vi.fn();

vi.mock("@/server/services", () => ({ dataService: ds }));
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));

const { compensationService } = await import("@/server/services/supabase-compensation");
const { CompensationClaimConflictError } = await import("@/lib/competitions/service-types");

const STORED_AT = "2026-03-01T10:00:00.000Z";
const ADMIN = { id: "u1", role: "super_admin", nombre: "Admin", email: "a@x.es" } as unknown as SessionUser;

const template = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
    pesajeRoles: [],
  },
];

function competitionRow(id: string, fecha: string): Row {
  return {
    id,
    nombre: `Copa ${id}`,
    tipo: "AEP-2",
    fecha,
    fecha_fin: fecha,
    sede: "Madrid",
    zona: "CENTRO",
    sesiones: 1,
    requeridos: 1,
    confirmados: 1,
    estado: "Completo",
    aprobacion: "Aprobado",
    template,
  };
}

function referee(id: string, nombre: string): Row {
  return { id, nombre, zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true };
}

function seed() {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const k of Object.keys(failures)) delete failures[k];
  tables.competitions = [competitionRow("c1", "2026-03-21"), competitionRow("c2", "2026-04-11")];
  tables.roster_assignments = [
    { competition_id: "c1", slot_key: "S1_central_0", referee_id: "j1", flags: {} },
  ];
  tables.referees = [referee("j1", "Ana Ruiz"), referee("j2", "Berta Gil")];
  tables.judge_compensation_claims = [
    {
      id: "cmp-c1-j1",
      competition_id: "c1",
      referee_id: "j1",
      referee_name: "Ana Ruiz",
      status: "borrador",
      travel_mode: "none",
      total_amount: 999,
      updated_at: STORED_AT,
    },
    {
      // Liquidación de un juez sustituido: fuera de tarima, conserva su cifra.
      id: "cmp-c1-j2",
      competition_id: "c1",
      referee_id: "j2",
      referee_name: "Berta Gil",
      status: "pagado",
      travel_mode: "none",
      total_amount: 50,
      session_count: 1,
      updated_at: STORED_AT,
    },
  ];
  tables.judge_compensation_duty_lines = [
    { id: "cmp-c1-j1-dl-0", claim_id: "cmp-c1-j1", duty_type: "session", session_label: "VIEJA", amount: 1, quantity: 1, unit_amount: 1, slot_keys: [] },
    { id: "cmp-c1-j2-dl-0", claim_id: "cmp-c1-j2", duty_type: "session", session_label: "S1", amount: 50, quantity: 1, unit_amount: 50, slot_keys: ["S1_central_0"] },
  ];
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
  depth = 0;
  staleUpdate = false;
  seed();
  for (const fn of Object.values(ds)) fn.mockReset();
  requireApiUser.mockReset();
});

const reads = (table: string) => calls.filter((c) => c.table === table && c.op === "select");
const maxDepth = () => Math.max(0, ...calls.map((c) => c.depth)) + 1;

describe("resumen de un campeonato (Supabase)", () => {
  it("mismo resultado: tarima rehecha desde la plantilla y el sustituido con sus conceptos guardados", async () => {
    const summary = await compensationService.getSummary("c1");
    expect(summary.claims.map((c) => c.refereeId)).toEqual(["j1", "j2"]);
    const [enTarima, fuera] = summary.claims;
    // Los conceptos del juez en tarima salen de la plantilla, no de lo guardado.
    expect(enTarima.dutyLines.length).toBeGreaterThan(0);
    expect(enTarima.dutyLines.some((l) => l.session === "VIEJA")).toBe(false);
    // El sustituido conserva cifra y conceptos guardados, marcado fuera de tarima.
    expect(fuera.offRoster).toBe(true);
    expect(fuera.totalAmount).toBe(50);
    expect(fuera.dutyLines.map((l) => l.session)).toEqual(["S1"]);
  });

  it("dos viajes en fila (antes cuatro), una lectura del campeonato y otra de sus asignaciones", async () => {
    await compensationService.getSummary("c1");
    expect(reads("competitions")).toHaveLength(1);
    expect(reads("roster_assignments")).toHaveLength(1);
    expect(reads("judge_compensation_claims").filter((c) => c.columns === "*")).toHaveLength(1);
    // Solo se piden los conceptos de la liquidación fuera de tarima.
    const lineas = reads("judge_compensation_duty_lines");
    expect(lineas).toHaveLength(1);
    expect(lineas[0].inFilter?.[1]).toEqual(["cmp-c1-j2"]);
    expect(maxDepth()).toBe(2);
  });

  it("sin nadie fuera de tarima no se consulta ningún concepto", async () => {
    tables.judge_compensation_claims = tables.judge_compensation_claims.filter((r) => r.referee_id === "j1");
    await compensationService.getSummary("c1");
    expect(reads("judge_compensation_duty_lines")).toHaveLength(0);
  });

  it("un fallo al leer las liquidaciones sigue siendo un error, no un resumen vacío", async () => {
    failures.judge_compensation_claims = "timeout";
    await expect(compensationService.getSummary("c1")).rejects.toThrow(/judge_compensation_claims: timeout/);
  });

  it("pero un campeonato que no existe sigue dando el resumen vacío, aunque fallen las liquidaciones", async () => {
    failures.judge_compensation_claims = "timeout";
    const summary = await compensationService.getSummary("no-existe");
    expect(summary).toMatchObject({ competitionId: "no-existe", claims: [], grandTotal: 0 });
  });
});

describe("editar una liquidación (Supabase)", () => {
  it("una sola lectura de la liquidación, que es también el testigo del compare-and-set", async () => {
    await compensationService.updateClaim("c1", "j1", { travelNotes: "revisado" });
    const lecturas = reads("judge_compensation_claims").filter((c) => c.columns !== "travel_amount_override");
    expect(lecturas).toHaveLength(1);
    const update = calls.find((c) => c.table === "judge_compensation_claims" && c.op === "update");
    expect(update?.eq).toContainEqual(["updated_at", STORED_AT]);
    // Ni conceptos (se rehacen desde la tarima) ni relecturas del campeonato.
    expect(reads("judge_compensation_duty_lines")).toHaveLength(0);
    expect(reads("competitions")).toHaveLength(1);
    expect(reads("roster_assignments")).toHaveLength(1);
    // Todas las lecturas en el primer viaje; antes eran cinco en fila.
    expect(Math.max(...lecturas.map((c) => c.depth), ...reads("competitions").map((c) => c.depth))).toBe(0);
  });

  it("sin fila guardada, la escritura es un alta (testigo null)", async () => {
    tables.judge_compensation_claims = [];
    await compensationService.updateClaim("c1", "j1", { travelNotes: "nuevo" });
    expect(calls.some((c) => c.table === "judge_compensation_claims" && c.op === "insert")).toBe(true);
    expect(calls.some((c) => c.table === "judge_compensation_claims" && c.op === "update")).toBe(false);
  });

  it("si la fila cambió por debajo, se sigue rechazando", async () => {
    // El UPDATE con testigo no casa: otra persona la guardó entre medias.
    staleUpdate = true;
    await expect(
      compensationService.updateClaim("c1", "j1", { travelNotes: "x" }),
    ).rejects.toBeInstanceOf(CompensationClaimConflictError);
  });

  it("un fallo al leer la liquidación aborta sin escribir (antes se ignoraba y se podía pisar)", async () => {
    failures.judge_compensation_claims = "timeout";
    await expect(
      compensationService.updateClaim("c1", "j1", { travelNotes: "x" }),
    ).rejects.toThrow(/judge_compensation_claims: timeout/);
    expect(calls.some((c) => c.op !== "select")).toBe(false);
  });

  it("un juez que no está en la tarima no tiene liquidación editable", async () => {
    expect(await compensationService.updateClaim("c1", "j2", { travelNotes: "x" })).toBeUndefined();
    expect(await compensationService.updateClaim("no-existe", "j1", { travelNotes: "x" })).toBeUndefined();
    expect(calls.some((c) => c.op !== "select")).toBe(false);
  });

  it("el recibo usa la misma liquidación fusionada", async () => {
    const claim = await compensationService.getClaimForExport("c1", "j1");
    expect(claim?.refereeId).toBe("j1");
    expect(claim?.dutyLines.some((l) => l.session === "VIEJA")).toBe(false);
    expect(await compensationService.getClaimForExport("c1", "j2")).toBeUndefined();
  });
});

describe("hub de compensación (Supabase)", () => {
  it("mismas cifras sin leer un solo concepto", async () => {
    const hub = await compensationService.getHub(ADMIN);
    expect(reads("judge_compensation_duty_lines")).toHaveLength(0);
    expect(hub.items).toHaveLength(1);
    const [item] = hub.items;
    expect(item.competitionId).toBe("c1");
    // El sustituido sigue contando con su cifra guardada.
    expect(item.judgeCount).toBe(2);
    expect(item.provisionalTotal).toBeGreaterThanOrEqual(50);
  });

  it("plantillas solo de campeonatos con jueces, y los jueces en paralelo con las liquidaciones", async () => {
    await compensationService.getHub(ADMIN);
    const plantillas = reads("competitions").filter((c) => c.columns === "id, template, tipo");
    expect(plantillas).toHaveLength(1);
    expect(plantillas[0].inFilter?.[1]).toEqual(["c1"]);
    const jueces = reads("referees");
    const liquidaciones = reads("judge_compensation_claims").filter((c) => c.columns === "*");
    expect(jueces[0].depth).toBe(liquidaciones[0].depth);
  });
});

describe("rutas de compensación", () => {
  const competition = { id: "c1", nombre: "Copa", fecha: "2026-03-21", fechaFin: "2026-03-21", sede: "Madrid", compensationOrganizer: "aep" } as unknown as Competition;
  const ctx = { params: Promise.resolve({ id: "c1" }) };

  it("GET: resumen y campeonato en paralelo, 404 si no existe", async () => {
    const { GET } = await import("@/app/api/v1/competitions/[id]/compensation/route");
    requireApiUser.mockResolvedValue(ADMIN);
    let enVuelo = 0;
    let maxEnVuelo = 0;
    const lento = <T,>(v: T) => {
      enVuelo++;
      maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
      return new Promise<T>((r) => setTimeout(() => (enVuelo--, r(v)), 1));
    };
    ds.getCompetition.mockImplementation(() => lento(competition));
    ds.getCompensationSummary.mockImplementation(() => lento({ competitionId: "c1", claims: [] }));
    const ok = await GET(new Request("http://x"), ctx);
    expect(ok.status).toBe(200);
    expect(maxEnVuelo).toBe(2);

    ds.getCompetition.mockResolvedValue(undefined);
    const nf = await GET(new Request("http://x"), ctx);
    expect(nf.status).toBe(404);
    expect((await nf.json()).error).toBe("Competición no encontrada");
  });

  it("GET: un fallo del resumen sigue siendo el error de la ruta", async () => {
    const { GET } = await import("@/app/api/v1/competitions/[id]/compensation/route");
    requireApiUser.mockResolvedValue(ADMIN);
    ds.getCompetition.mockResolvedValue(competition);
    ds.getCompensationSummary.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("No se pudo cargar la compensación");
  });

  describe("export del recibo", () => {
    const exportCtx = { params: Promise.resolve({ id: "c1", refereeId: "j1" }) };
    const body = () =>
      new Request("http://x", { method: "POST", body: JSON.stringify({ iban: "ES9121000418450200051332" }) });

    it("sin getRoster, y la liquidación se pide a la vez que el resto", async () => {
      const { POST } = await import(
        "@/app/api/v1/competitions/[id]/compensation/[refereeId]/export/route"
      );
      requireApiUser.mockResolvedValue(ADMIN);
      const orden: string[] = [];
      ds.getCompetition.mockImplementation(async () => (orden.push("competition"), competition));
      ds.getReferee.mockImplementation(async () => (orden.push("referee"), { id: "j1", nombre: "Ana" }));
      ds.getCompensationClaimForExport.mockImplementation(async () => (orden.push("claim"), undefined));
      const res = await POST(body(), exportCtx);
      expect(ds.getRoster).not.toHaveBeenCalled();
      expect(orden.slice(0, 3).sort()).toEqual(["claim", "competition", "referee"]);
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("Claim no encontrado");
    });

    it("el 404 del campeonato o el juez sigue ganando a un fallo de la liquidación", async () => {
      const { POST } = await import(
        "@/app/api/v1/competitions/[id]/compensation/[refereeId]/export/route"
      );
      requireApiUser.mockResolvedValue(ADMIN);
      ds.getCompetition.mockResolvedValue(undefined);
      ds.getReferee.mockResolvedValue({ id: "j1", nombre: "Ana" });
      ds.getCompensationClaimForExport.mockRejectedValue(new Error("boom"));
      const res = await POST(body(), exportCtx);
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("Campeonato, tarima o juez no encontrado");
    });

    it("un fallo de la liquidación conserva su mensaje propio", async () => {
      const { POST } = await import(
        "@/app/api/v1/competitions/[id]/compensation/[refereeId]/export/route"
      );
      requireApiUser.mockResolvedValue(ADMIN);
      ds.getCompetition.mockResolvedValue(competition);
      ds.getReferee.mockResolvedValue({ id: "j1", nombre: "Ana" });
      ds.getCompensationClaimForExport.mockRejectedValue(new Error("boom"));
      const res = await POST(body(), exportCtx);
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("No se pudo cargar la liquidación del juez");
    });
  });
});

// La página y el tablero son .tsx y vitest no transforma JSX en este
// proyecto (tsconfig con `jsx: preserve`): se fija el contrato en el fuente,
// como hacen las demás pruebas de pantallas.
describe("página y tablero de compensación", () => {
  const leer = async (rel: string) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(process.cwd(), rel), "utf8");
  };

  it("la página trae el resumen en el servidor, en paralelo con el campeonato", async () => {
    const src = await leer("src/app/(dashboard)/competitions/[id]/compensation/page.tsx");
    expect(src).toMatch(
      /Promise\.all\(\[\s*dataService\.getCompetition\(id\),\s*dataService\.getCompensationSummary\(id\)\.catch\(/,
    );
    expect(src).toMatch(/initialSummary=\{initialSummary\}/);
    // Sigue: RBAC antes de leer nada y notFound si no existe.
    expect(src.indexOf("canManageCompensation(user)")).toBeLessThan(src.indexOf("Promise.all"));
    expect(src).toMatch(/if \(!competition\) notFound\(\);/);
  });

  it("si el resumen falla en la página, no la tumba: el tablero lo pide como antes", async () => {
    const src = await leer("src/app/(dashboard)/competitions/[id]/compensation/page.tsx");
    expect(src).toMatch(/getCompensationSummary\(id\)\.catch\(\(err: unknown\) => \{[\s\S]*?return undefined;/);
  });

  it("el tablero arranca con el resumen del servidor y no lo vuelve a pedir al montar", async () => {
    const src = await leer("src/components/competitions/compensation-board.tsx");
    expect(src).toMatch(/useState<CompetitionCompensationSummary \| null>\(initialSummary \?\? null\)/);
    expect(src).toMatch(/useRef\(initialSummary \? initialCompetition\.id : null\)/);
    expect(src).toMatch(/if \(!debePedirResumen\(initialSummary\)\) return;\s*\}\s*load\(\);/);
  });

  it("al volver atrás con la página de la caché, el tablero pide el resumen al día", async () => {
    const { debePedirResumen } = await import("@/components/competitions/compensation-initial-summary");
    const delServidor = { claims: [] } as unknown as Parameters<typeof debePedirResumen>[0];
    // Primera vez que se pinta: no se pide.
    expect(debePedirResumen(delServidor)).toBe(false);
    // El mismo objeto otra vez = la página reutilizada al volver: se pide.
    expect(debePedirResumen(delServidor)).toBe(true);
    // Una navegación nueva trae otro objeto: no se pide.
    expect(debePedirResumen({ ...delServidor! })).toBe(false);
    // Sin resumen del servidor, siempre.
    expect(debePedirResumen(undefined)).toBe(true);
  });
});
