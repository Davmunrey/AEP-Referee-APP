import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Competition, RosterSession, SessionUser } from "@/lib/types";

// Rendimiento de las pantallas de campeonatos (lectura), sin cambiar lo que se
// ve:
//  - /competitions y /approvals leían `roster_assignments` ENTERA, de todas las
//    temporadas, en páginas de 1000 pedidas una tras otra; el delegado de zona
//    pagaba el calendario nacional para quedarse con su zona.
//  - /approvals mandaba al navegador todos los campeonatos para leer un estado.
//  - El mapa de «ya asignado en otro campeonato» encadenaba tres viajes.
//  - La tarima mandaba el censo entero (PII y estadísticas por año) y la vista
//    previa del cuadrante volvía a pedir al servidor lo que la página ya tenía.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

// ── Base falsa con incrustación de `roster_assignments` ─────────────────────

type Row = Record<string, unknown>;
type Peticion = {
  table: string;
  select: string;
  orders: string[];
  filtros: string[];
  rangos: { from: number; to: number }[];
};

let tablas: Record<string, Row[]>;
let peticiones: Peticion[];
let fallo: string | null;
/** Si se activa, `range` no resuelve hasta llamar a `soltar()`. */
let retener: boolean;
let pendientes: (() => void)[];

function embebido(select: string, comp: Row): Row {
  const m = /roster_assignments\(([^)]*)\)/.exec(select);
  if (!m) return { ...comp };
  const cols = m[1]!.split(",").map((c) => c.trim());
  const filas = (tablas.roster_assignments ?? [])
    .filter((a) => a.competition_id === comp.id)
    .map((a) => Object.fromEntries(cols.map((c) => [c, a[c]])));
  return { ...comp, roster_assignments: filas };
}

function from(table: string) {
  const p: Peticion = { table, select: "", orders: [], filtros: [], rangos: [] };
  peticiones.push(p);
  const preds: ((r: Row) => boolean)[] = [];
  const run = (desde = 0, hasta = Number.POSITIVE_INFINITY) => {
    if (fallo) return { data: null, error: { message: fallo } };
    const hit = (tablas[table] ?? []).filter((r) => preds.every((f) => f(r)));
    const page = hit.slice(desde, hasta + 1).map((r) => embebido(p.select, r));
    return { data: page, error: null };
  };
  const q: Record<string, unknown> = {
    select: (cols: string) => ((p.select = cols), q),
    order: (col: string) => (p.orders.push(col), q),
    eq: (c: string, v: unknown) => (p.filtros.push(`eq:${c}=${String(v)}`), preds.push((r) => r[c] === v), q),
    neq: (c: string, v: unknown) => (p.filtros.push(`neq:${c}`), preds.push((r) => r[c] !== v), q),
    lte: (c: string, v: string) => (p.filtros.push(`lte:${c}`), preds.push((r) => String(r[c]) <= v), q),
    gte: (c: string, v: string) => (p.filtros.push(`gte:${c}`), preds.push((r) => String(r[c]) >= v), q),
    in: (c: string, v: unknown[]) => (p.filtros.push(`in:${c}:${v.length}`), preds.push((r) => v.includes(r[c])), q),
    range: (desde: number, hasta: number) => {
      p.rangos.push({ from: desde, to: hasta });
      if (!retener) return Promise.resolve(run(desde, hasta));
      return new Promise((resolve) => pendientes.push(() => resolve(run(desde, hasta))));
    },
    maybeSingle: async () => {
      const r = run();
      return { data: r.data?.[0] ?? null, error: r.error };
    },
    single: async () => {
      const r = run();
      return { data: r.data?.[0] ?? null, error: r.error };
    },
    then: (resolve: (r: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

import { competitionService } from "@/server/services/supabase-competitions";
import * as memoryCompetitions from "@/server/services/memory-competitions";
import { applyCoverageToCompetition } from "@/lib/roster-coverage";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import { mapCompetition } from "@/server/db/mappers";

// ── Datos ───────────────────────────────────────────────────────────────────

const TEMPLATE: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00",
    horarioPesaje: "08:30",
    roles: [
      { rol: "Juez Central", slots: 1, key: "central" },
      { rol: "Juez Lateral", slots: 2, key: "lateral" },
    ],
    pesajeRoles: [],
  },
];

function comp(id: string, zona: string, extra: Row = {}): Row {
  return {
    id,
    nombre: `Campeonato ${id}`,
    tipo: "AEP-1",
    fecha: "2026-05-02",
    fecha_fin: "2026-05-03",
    sede: "Madrid",
    sesiones: 1,
    requeridos: 3,
    confirmados: 0,
    estado: "Borrador",
    aprobacion: "Sin propuesta",
    zona,
    template: TEMPLATE,
    ...extra,
  };
}

function asignar(competitionId: string, slots: Record<string, string>) {
  for (const [slot_key, referee_id] of Object.entries(slots)) {
    (tablas.roster_assignments ??= []).push({ competition_id: competitionId, slot_key, referee_id, flags: {} });
  }
}

/** Lo que salía por el camino antiguo: fila + mapa de asignaciones aparte. */
function esperado(row: Row): Competition {
  const assignments = Object.fromEntries(
    (tablas.roster_assignments ?? [])
      .filter((a) => a.competition_id === row.id)
      .map((a) => [String(a.slot_key), String(a.referee_id)]),
  );
  const c = mapCompetition(row);
  return applyCoverageToCompetition(c, normalizeCompetitionTemplate(TEMPLATE, c.tipo), assignments);
}

const delegado = (zona?: string): SessionUser =>
  ({ id: "u-del", role: "delegado_zona", zona, nombre: "Del", email: "d@x" }) as unknown as SessionUser;

beforeEach(() => {
  tablas = {};
  peticiones = [];
  fallo = null;
  retener = false;
  pendientes = [];
});

const deTabla = (t: string) => peticiones.filter((p) => p.table === t);

// ── getCompetitions ─────────────────────────────────────────────────────────

describe("getCompetitions: asignaciones incrustadas, sin barrer roster_assignments", () => {
  it("misma cobertura que el camino antiguo, en una sola petición y sin tocar roster_assignments", async () => {
    tablas.competitions = [comp("evt-001", "CENTRO"), comp("evt-002", "CENTRO"), comp("evt-003", "ANDALUCIA")];
    asignar("evt-001", { S1_central_0: "j1", S1_lateral_0: "j2", S1_lateral_1: "j3" });
    asignar("evt-002", { S1_central_0: "j1" });

    const list = await competitionService.getCompetitions();

    expect(list).toEqual(tablas.competitions.map(esperado));
    expect(list.map((c) => c.estado)).toEqual(["Completo", "Incompleto", "Borrador"]);
    expect(deTabla("roster_assignments")).toHaveLength(0);
    const [p] = deTabla("competitions");
    expect(p!.select).toBe("*, roster_assignments(slot_key, referee_id)");
    expect(p!.orders).toEqual(["fecha", "id"]);
    // La fila incrustada no se cuela en el objeto de dominio.
    expect(list[0]).not.toHaveProperty("roster_assignments");
  });

  it("sigue paginando el calendario a partir de 1000 campeonatos", async () => {
    tablas.competitions = Array.from({ length: 1200 }, (_, i) =>
      comp(`evt-${String(i).padStart(4, "0")}`, "CENTRO"),
    );
    const list = await competitionService.getCompetitions();
    expect(list).toHaveLength(1200);
    expect(deTabla("competitions").flatMap((p) => p.rangos)).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });

  it("el delegado filtra su zona en la base y ve lo mismo que antes", async () => {
    tablas.competitions = [comp("evt-001", "CENTRO"), comp("evt-002", "ANDALUCIA")];
    const list = await competitionService.getCompetitions(delegado("Centro"));
    expect(list.map((c) => c.id)).toEqual(["evt-001"]);
    expect(deTabla("competitions")[0]!.filtros).toContain("eq:zona=CENTRO");
  });

  it("delegado con zona ilegible: nada, y sin consultar", async () => {
    tablas.competitions = [comp("evt-001", "CENTRO")];
    expect(await competitionService.getCompetitions(delegado("???"))).toEqual([]);
    expect(peticiones).toHaveLength(0);
  });

  it("un error de lectura sigue lanzando", async () => {
    fallo = "timeout";
    await expect(competitionService.getCompetitions()).rejects.toThrow(/competitions: timeout/);
  });
});

// ── getCompetitionEstados ───────────────────────────────────────────────────

describe("getCompetitionEstados: solo los campeonatos de las propuestas", () => {
  it("devuelve el mismo estado que getCompetitions para los ids pedidos", async () => {
    tablas.competitions = [comp("evt-001", "CENTRO"), comp("evt-002", "CENTRO"), comp("evt-003", "CENTRO")];
    asignar("evt-001", { S1_central_0: "j1", S1_lateral_0: "j2", S1_lateral_1: "j3" });
    asignar("evt-002", { S1_central_0: "j1" });

    const estados = await competitionService.getCompetitionEstados(["evt-001", "evt-002", "evt-001", "evt-x"]);

    expect(estados).toEqual({ "evt-001": "Completo", "evt-002": "Incompleto" });
    const [p] = deTabla("competitions");
    // Ni `select *` ni la columna `estado` guardada: la cuenta de cobertura.
    expect(p!.select).toBe("id, tipo, requeridos, template, roster_assignments(slot_key, referee_id)");
    expect(p!.filtros).toContain("in:id:3");
    expect(deTabla("roster_assignments")).toHaveLength(0);
  });

  it("trocea el .in() y lanza las tandas en paralelo", async () => {
    tablas.competitions = Array.from({ length: 650 }, (_, i) => comp(`evt-${i}`, "CENTRO"));
    retener = true;
    const promesa = competitionService.getCompetitionEstados(tablas.competitions.map((c) => String(c.id)));
    await Promise.resolve();
    // Las tres tandas (300 + 300 + 50) ya han salido antes de que vuelva ninguna.
    expect(deTabla("competitions").map((p) => p.filtros.find((f) => f.startsWith("in:")))).toEqual([
      "in:id:300",
      "in:id:300",
      "in:id:50",
    ]);
    for (const soltar of pendientes) soltar();
    expect(Object.keys(await promesa)).toHaveLength(650);
  });

  it("mismo ámbito de zona que getCompetitions", async () => {
    tablas.competitions = [comp("evt-001", "CENTRO"), comp("evt-002", "ANDALUCIA")];
    const estados = await competitionService.getCompetitionEstados(["evt-001", "evt-002"], delegado("CENTRO"));
    expect(Object.keys(estados)).toEqual(["evt-001"]);
    expect(deTabla("competitions")[0]!.filtros).toContain("eq:zona=CENTRO");

    peticiones = [];
    expect(await competitionService.getCompetitionEstados(["evt-001"], delegado(""))).toEqual({});
    expect(await competitionService.getCompetitionEstados([])).toEqual({});
    expect(peticiones).toHaveLength(0);
  });

  it("un error de lectura lanza", async () => {
    fallo = "caído";
    await expect(competitionService.getCompetitionEstados(["evt-001"])).rejects.toThrow(/competitions: caído/);
  });

  it("el gemelo en memoria cuadra con su getCompetitions", async () => {
    const todos = await memoryCompetitions.getCompetitions();
    const ids = todos.slice(0, 3).map((c) => c.id);
    const estados = await memoryCompetitions.getCompetitionEstados([...ids, "no-existe"]);
    expect(estados).toEqual(Object.fromEntries(todos.slice(0, 3).map((c) => [c.id, c.estado])));
  });
});

// ── getRefereeBusyMap ───────────────────────────────────────────────────────

describe("getRefereeBusyMap: dos viajes en vez de tres", () => {
  it("los jueces de los campeonatos solapados vienen incrustados", async () => {
    tablas.competitions = [
      comp("evt-001", "CENTRO"),
      comp("evt-002", "CENTRO", { nombre: "Open Norte", fecha: "2026-05-03", fecha_fin: "2026-05-04" }),
      comp("evt-003", "CENTRO", { fecha: "2026-06-10", fecha_fin: "2026-06-11" }),
    ];
    asignar("evt-002", { S1_central_0: "j1", S1_lateral_0: "j1", S1_lateral_1: "j2" });
    asignar("evt-003", { S1_central_0: "j3" });

    const busy = await competitionService.getRefereeBusyMap("evt-001");

    const entrada = { competitionId: "evt-002", competitionName: "Open Norte", fecha: "2026-05-03", fechaFin: "2026-05-04" };
    expect(busy).toEqual({ j1: [entrada], j2: [entrada] });
    expect(deTabla("competitions")).toHaveLength(2);
    expect(deTabla("competitions")[1]!.select).toBe("id, nombre, fecha, fecha_fin, roster_assignments(referee_id)");
    expect(deTabla("roster_assignments")).toHaveLength(0);
  });

  it("sin solapes, vacío y sin tercera consulta", async () => {
    tablas.competitions = [comp("evt-001", "CENTRO")];
    expect(await competitionService.getRefereeBusyMap("evt-001")).toEqual({});
  });
});

// ── Páginas y componentes (.tsx) ────────────────────────────────────────────
// Vitest corre aquí sin transformar JSX (tsconfig `jsx: preserve`), así que,
// como el resto de la batería, las páginas se comprueban sobre su fuente.

const fuente = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

describe("/approvals ya no carga ni envía todos los campeonatos", () => {
  const page = fuente("src/app/(dashboard)/approvals/page.tsx");
  const board = fuente("src/components/approvals/approvals-board.tsx");

  it("pide solo el estado de los campeonatos de las propuestas", () => {
    expect(page).not.toContain("getCompetitions(");
    expect(page).toMatch(/getCompetitionEstados\(\s*approvals\.map\(\(a\) => a\.competitionId\),\s*user,?\s*\)/);
    // El censo sigue en paralelo con la cadena propuestas → estados.
    expect(page).toMatch(/Promise\.all\(\[\s*conEstados,\s*dataService\.getReferees\(\{ user \}\)/);
    expect(page).toContain("estadoById={estadoById}");
    expect(page).not.toMatch(/competitions=\{/);
  });

  it("el tablero cae en «Incompleto» igual que cuando el campeonato no estaba en la lista", () => {
    expect(board).toContain('estadoById[selected.competitionId] ?? "Incompleto"');
    expect(board).not.toContain("competitions.find(");
  });
});

describe("/competitions/[id]: censo recortado, miga sembrada y cuadrante local", () => {
  const page = fuente("src/app/(dashboard)/competitions/[id]/page.tsx");

  it("el censo llega solo con los campos que usa la tarima, después del recorte por rol", () => {
    const proyeccion = /stripRefereeListPII\(referees, user\)\.map\(\s*\(\{([^}]*)\}\)/.exec(page);
    expect(proyeccion).not.toBeNull();
    const campos = proyeccion![1]!.split(",").map((c) => c.trim()).filter(Boolean).sort();
    expect(campos).toEqual(
      ["arbitrajeStats", "disp", "estado", "eventos", "id", "iniciales", "nivel", "nombre", "ultimo", "zona"].sort(),
    );
    expect(page).toContain("referees={rosterReferees}");
    expect(page).not.toContain("referees={stripRefereeListPII(referees, user)}");
  });

  it("ningún componente de la tarima lee los campos que ya no viajan", () => {
    const arbol = [
      "src/components/competitions/roster-builder.tsx",
      "src/components/competitions/roster-referee-panel.tsx",
      "src/components/competitions/roster-referee-card.tsx",
      "src/components/competitions/roster-slot-grid.tsx",
      "src/components/competitions/roster-session-block.tsx",
      "src/components/competitions/convocatoria-dialog.tsx",
      "src/components/competitions/competition-availability-dialog.tsx",
      "src/lib/roster-ui.ts",
      "src/lib/roster-rules.ts",
    ];
    const prohibido =
      /\.(email|telefono|localidad|domicilio\w*|notas|userId|licencia|antiguedad|excelId|excelMacroZone|ultimoFecha|arbitrajeStatsByYear)\b/;
    expect(arbol.filter((f) => prohibido.test(fuente(f)))).toEqual([]);
  });

  it("siembra la miga con el nombre y envuelve la tarima con los datos del cuadrante", () => {
    expect(page).toContain("<CompetitionCrumbSeed id={competition.id} nombre={competition.nombre} />");
    expect(page).toMatch(/<RosterQuadrantSourceProvider[\s\S]*<RosterBuilder[\s\S]*<\/RosterQuadrantSourceProvider>/);
    // Los mismos objetos a los dos lados: React los serializa una sola vez.
    expect(page).toContain("assignments={roster.assignments}");
    expect(page).toContain("initialAssignments={roster.assignments}");
    expect(page).toContain("flags={flags}");
    expect(page).toContain("initialFlags={flags}");
  });
});

describe("miga de pan: sin GET /api/v1/competitions/[id] en la tarima", () => {
  const crumb = fuente("src/components/layout/competition-crumb-label.tsx");

  it("solo pide el campeonato en compensación y si no lo sembró ya la tarima", () => {
    expect(crumb).toMatch(
      /if \(!competitionId \|\| !onCompensation \|\| crumbNameCache\.has\(competitionId\)\) return;\s*void api\s*\.getCompetition/,
    );
    expect(crumb).toContain("useSyncExternalStore(");
    expect(crumb).toMatch(/export function CompetitionCrumbSeed[\s\S]*useLayoutEffect/);
  });
});

describe("vista previa del cuadrante sin petición tras hidratar", () => {
  const panel = fuente("src/components/competitions/roster-revision-panel.tsx");

  it("con los datos de la página genera el HTML con la misma llamada que la ruta", () => {
    expect(panel).toMatch(
      /generateQuadrantHtml\(\s*source\.competition,\s*source\.template,\s*source\.assignments,\s*source\.refLookup,\s*source\.flags,\s*false,\s*true,?\s*\)/,
    );
    const route = fuente("src/app/api/v1/competitions/[id]/roster/quadrant/route.ts");
    // `embed` = true en la vista previa, igual que `?embed=1`.
    expect(route).toContain('const embed = search.get("embed") === "1";');
  });

  it("y solo vuelve a la ruta cuando no hay datos de la página", () => {
    expect(panel).toMatch(/useEffect\(\(\) => \{\s*if \(hasSource\) return;/);
    expect(panel).toContain("}, [quadrantUrl, hasSource]);");
    // Imprimir y abrir siguen yendo a la ruta, con su propia comprobación de acceso.
    expect(panel).toContain("href={`${quadrantUrl}?print=1`}");
  });
});
