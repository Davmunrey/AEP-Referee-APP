import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Referee, SessionUser } from "@/lib/types";

/**
 * Rendimiento de las pantallas de personas (jueces, exámenes, informes,
 * ascensos, soporte, usuarios): lecturas independientes que iban una detrás de
 * otra, y censos enteros leídos para pintar un desplegable.
 *
 * Cada consulta simulada queda retenida hasta que la prueba suelta la «ola»
 * entera de peticiones en vuelo. El número de olas es el número de viajes
 * SEGUIDOS a la base de datos: lo que se paga en latencia. Las pruebas fijan
 * ese número y, a la vez, que el resultado y los errores siguen siendo los de
 * antes.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

type Result = { data: unknown; error: { code?: string; message: string } | null };
type Call = {
  table: string;
  columns?: string;
  filters: [string, unknown][];
  orders: string[];
  terminal: string;
};

let respond: (call: Call) => Result;
let calls: Call[];
let pending: (() => void)[];

/** La petición no contesta hasta que se suelta su ola. */
function gate<T>(produce: () => T): Promise<T> {
  return new Promise((resolve) => pending.push(() => resolve(produce())));
}

function query(table: string) {
  const call: Call = { table, filters: [], orders: [], terminal: "then" };
  const finish = (terminal: string) => {
    call.terminal = terminal;
    calls.push(call);
    return gate(() => respond(call));
  };
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: (columns?: string) => ((call.columns = columns ?? "*"), q),
    eq: (c: string, v: unknown) => (call.filters.push([c, v]), q),
    in: (c: string, v: unknown) => (call.filters.push([c, v]), q),
    is: (c: string, v: unknown) => (call.filters.push([c, v]), q),
    lt: (c: string, v: unknown) => (call.filters.push([c, v]), q),
    neq: () => q,
    ilike: () => q,
    update: () => q,
    order: (c: string) => (call.orders.push(c), q),
    range: () => q,
    single: () => finish("single"),
    maybeSingle: () => finish("maybeSingle"),
    then: (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => finish("then").then(ok, ko),
  });
  return q;
}

let signed: string[];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: query,
    storage: {
      from: () => ({
        createSignedUrl: (path: string) =>
          gate(() => {
            signed.push(path);
            return { data: { signedUrl: `https://firmada/${path}` }, error: null };
          }),
      }),
    },
  }),
}));

// `judge-accounts` avisa por `dataService`; aquí no hace falta nada más.
vi.mock("@/server/services", () => ({
  dataService: { insertNotificaciones: async () => undefined },
}));
vi.mock("@/server/destinatarios", () => ({
  delegadosDeZona: async () => [],
  gestionNacional: async () => [],
}));

const { refereeService } = await import("@/server/services/supabase-referees");
const { examsService } = await import("@/server/services/supabase-exams");
const { ticketService } = await import("@/server/services/supabase-tickets");
const { getJudgeAccessStatuses } = await import("@/server/services/judge-accounts");
const memoryReferees = await import("@/server/services/memory-referees");
const { getStore } = await import("@/server/store");

/** Ejecuta `work` soltando las peticiones por olas y cuenta cuántas hicieron falta. */
async function inWaves<T>(work: () => Promise<T>): Promise<{ value?: T; error?: unknown; waves: number }> {
  let done = false;
  let value: T | undefined;
  let error: unknown;
  work().then(
    (v) => ((done = true), (value = v)),
    (e) => ((done = true), (error = e)),
  );
  let waves = 0;
  for (let guard = 0; guard < 50; guard++) {
    await new Promise((r) => setTimeout(r, 0));
    if (done) break;
    if (pending.length === 0) continue;
    const ola = pending;
    pending = [];
    waves++;
    for (const release of ola) release();
  }
  if (!done) throw new Error("la operación no terminó");
  return { value, error, waves };
}

const ok = (data: unknown): Result => ({ data, error: null });
const fail = (message: string, code?: string): Result => ({ data: null, error: { message, code } });

const NACIONAL: SessionUser = {
  id: "u-nac",
  nombre: "Nacional",
  iniciales: "NA",
  email: "nac@aep.test",
  rol: "Delegado de Jueces",
  role: "delegado_jueces",
};
const DELEGADO: SessionUser = {
  ...NACIONAL,
  id: "u-del",
  role: "delegado_zona",
  rol: "Delegado de Zona",
  zona: "2- CENTRO",
};

beforeEach(() => {
  calls = [];
  pending = [];
  signed = [];
  respond = () => ok([]);
});

// ── Ficha del juez ──────────────────────────────────────────────────────────
const FILA_JUEZ = { id: "ref-1", nombre: "Juez Uno", zona: "CENTRO", nivel: "Nacional", estado: "Activo" };
const CAMPEONATO = {
  id: "c1",
  nombre: "Open Centro",
  tipo: "AEP-2",
  fecha: "2026-03-01",
  fecha_fin: "2026-03-02",
  sede: "Madrid",
  estado: "Finalizado",
  aprobacion: "aprobado",
};

describe("ficha del juez: un solo viaje en vez de tres", () => {
  it("lanza la ficha, exámenes, informes, sanciones e historial a la vez", async () => {
    respond = (c) => {
      if (c.table === "referees") return ok(FILA_JUEZ);
      if (c.table === "roster_assignments") {
        // Dos plazas en el mismo campeonato: el campeonato incrustado se repite.
        return ok([
          { competition_id: "c1", slot_key: "S1_central_0", flags: null, competitions: CAMPEONATO },
          { competition_id: "c1", slot_key: "S2_central_0", flags: null, competitions: CAMPEONATO },
        ]);
      }
      return ok([]);
    };
    const { value, waves } = await inWaves(() =>
      refereeService.getJudgeProfile("ref-1", (id) => examsService.getExams(id), (id) =>
        examsService.getReports(id),
      ),
    );
    // Antes: ficha → (exámenes, informes, sanciones, designaciones) → campeonatos.
    expect(waves).toBe(1);
    // El campeonato viene incrustado; ya no hay un `.in()` aparte.
    expect(calls.some((c) => c.table === "competitions")).toBe(false);
    const asignaciones = calls.find((c) => c.table === "roster_assignments")!;
    expect(asignaciones.columns).toContain("competitions(");
    expect(asignaciones.filters).toEqual([["referee_id", "ref-1"]]);
    // Y el historial sale igual: un campeonato, con sus dos sesiones.
    expect(value?.referee.id).toBe("ref-1");
    expect(value?.competitionHistory).toHaveLength(1);
    expect(value?.competitionHistory[0]).toMatchObject({
      competitionId: "c1",
      competitionName: "Open Centro",
      sede: "Madrid",
      slotCount: 2,
    });
  });

  it("un juez inexistente sigue siendo undefined aunque otra lectura falle", async () => {
    respond = (c) => {
      if (c.table === "referees") return fail("no rows", "PGRST116");
      if (c.table === "roster_assignments") return fail("statement timeout");
      return ok([]);
    };
    const { value, error } = await inWaves(() =>
      refereeService.getJudgeProfile("nadie", async () => [], async () => []),
    );
    expect(error).toBeUndefined();
    expect(value).toBeUndefined();
  });

  it("si falla la ficha, el error que sale es el de la ficha, no el de otra lectura", async () => {
    respond = (c) => {
      if (c.table === "referees") return fail("connection reset");
      if (c.table === "referee_sanctions") return fail("deadlock");
      return ok([]);
    };
    const { error } = await inWaves(() =>
      refereeService.getJudgeProfile("ref-1", async () => [], async () => []),
    );
    expect(String(error)).toMatch(/referees: connection reset/);
  });

  it("perder los campeonatos sigue lanzando, no deja un historial recortado", async () => {
    respond = (c) => {
      if (c.table === "referees") return ok(FILA_JUEZ);
      if (c.table === "roster_assignments") return fail("could not find a relationship");
      return ok([]);
    };
    const { error } = await inWaves(() =>
      refereeService.getJudgeProfile("ref-1", async () => [], async () => []),
    );
    expect(String(error)).toMatch(/roster_assignments/);
  });
});

// ── Acceso al portal ────────────────────────────────────────────────────────
const juez = (n: number, patch: Partial<Referee> = {}): Referee => ({
  id: `j${n}`,
  nombre: `Juez ${n}`,
  zona: "CENTRO",
  nivel: "Regional",
  estado: "Activo",
  eventos: 0,
  ultimo: "",
  disp: true,
  iniciales: "JJ",
  userId: `u${n}`,
  ...patch,
});

describe("estado de acceso al portal: perfiles y códigos a la vez", () => {
  it("un solo viaje y los mismos estados de antes", async () => {
    respond = (c) => {
      if (c.table === "profiles") {
        return ok([
          { id: "u1", activo: true, role: "juez" },
          { id: "u2", activo: false, role: "juez" },
          { id: "u3", activo: true, role: "juez" },
          // Una cuenta que no es de juez no cuenta como acceso.
          { id: "u4", activo: true, role: "delegado_zona" },
        ]);
      }
      if (c.table === "judge_access_codes") {
        return ok([{ referee_id: "j1", code_hash: "h", expires_at: "2026-12-01T00:00:00Z", attempts: 0 }]);
      }
      return ok([]);
    };
    const refs = [juez(1), juez(2), juez(3), juez(4), juez(5, { userId: undefined })];
    const { value, waves } = await inWaves(() => getJudgeAccessStatuses(refs));
    expect(waves).toBe(1);
    expect(value?.statuses).toEqual({
      j1: "codigo-pendiente",
      j2: "revocado",
      j3: "con-acceso",
      j4: "sin-acceso",
      j5: "sin-acceso",
    });
    expect(value?.codeExpiry).toEqual({ j1: "2026-12-01T00:00:00Z" });
  });

  it("con más de 200 cuentas sigue troceando, pero todo en un solo viaje", async () => {
    respond = () => ok([]);
    const refs = Array.from({ length: 250 }, (_, i) => juez(i + 1));
    const { waves } = await inWaves(() => getJudgeAccessStatuses(refs));
    expect(waves).toBe(1);
    const perfiles = calls.filter((c) => c.table === "profiles");
    const codigos = calls.filter((c) => c.table === "judge_access_codes");
    expect(perfiles.map((c) => (c.filters[0]![1] as string[]).length)).toEqual([200, 50]);
    expect(codigos.map((c) => (c.filters[0]![1] as string[]).length)).toEqual([200, 50]);
  });

  it("un fallo de lectura sigue lanzando en vez de dar «sin acceso»", async () => {
    respond = (c) => (c.table === "judge_access_codes" ? fail("timeout") : ok([]));
    const { error } = await inWaves(() => getJudgeAccessStatuses([juez(1)]));
    expect(String(error)).toMatch(/judge_access_codes: timeout/);
  });
});

// ── Exámenes del delegado de zona ───────────────────────────────────────────
describe("exámenes del delegado: la zona se filtra en la misma petición", () => {
  it("un viaje, con la zona canonicalizada sobre el juez incrustado", async () => {
    respond = () => ok([{ id: "e1", referee_id: "j1", referee_name: "Ana", referees: { zona: "CENTRO" } }]);
    const { value, waves } = await inWaves(() => examsService.getExams(undefined, DELEGADO));
    expect(waves).toBe(1);
    expect(calls.map((c) => c.table)).toEqual(["referee_exams"]);
    expect(calls[0]!.columns).toBe("*, referees!inner(zona)");
    expect(calls[0]!.filters).toContainEqual(["referees.zona", "CENTRO"]);
    // El juez incrustado no se cuela en el examen.
    expect(value).toHaveLength(1);
    expect(value![0]).not.toHaveProperty("referees");
    expect(value![0]!.refereeId).toBe("j1");
  });

  it("un rol nacional no lleva ni el juez incrustado ni filtro de zona", async () => {
    await inWaves(() => examsService.getExams(undefined, NACIONAL));
    expect(calls[0]!.columns).toBe("*");
    expect(calls[0]!.filters.some(([c]) => c === "referees.zona")).toBe(false);
  });

  it("un delegado sin zona sigue sin ver nada, y sin preguntar", async () => {
    const { value } = await inWaves(() => examsService.getExams(undefined, { ...DELEGADO, zona: undefined }));
    expect(value).toEqual([]);
    expect(calls).toEqual([]);
  });
});

// ── Censo para desplegables ─────────────────────────────────────────────────
describe("getRefereeOptions: el censo de un desplegable, sin la ficha entera", () => {
  it("pide solo cuatro columnas, con el mismo orden y alcance que getReferees", async () => {
    respond = (c) =>
      c.table === "referees"
        ? ok([{ id: "j1", nombre: "Ana", nivel: "Nacional", estado: "Activo" }])
        : ok([]);
    const { value } = await inWaves(() => refereeService.getRefereeOptions({ user: DELEGADO }));
    const censo = calls.find((c) => c.table === "referees")!;
    expect(censo.columns).toBe("id, nombre, nivel, estado");
    expect(censo.orders).toEqual(["nombre", "id"]);
    expect(censo.filters).toContainEqual(["zona", "CENTRO"]);
    expect(value).toEqual([{ id: "j1", nombre: "Ana", nivel: "Nacional", estado: "Activo" }]);
  });

  it("un delegado con la zona ilegible no lee el censo (fail-closed)", async () => {
    const { value } = await inWaves(() =>
      refereeService.getRefereeOptions({ user: { ...DELEGADO, zona: "" } }),
    );
    expect(value).toEqual([]);
    expect(calls.some((c) => c.table === "referees")).toBe(false);
  });

  it("el twin en memoria devuelve los mismos jueces que getReferees, recortados", async () => {
    // El almacén en memoria solo existe sin Supabase configurado.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    let todos: Referee[];
    let opciones: Awaited<ReturnType<typeof memoryReferees.getRefereeOptions>>;
    try {
      const store = getStore();
      store.referees.length = 0;
      store.referees.push(
        juez(1, { nombre: "Zoe", zona: "CENTRO", email: "z@aep.test", telefono: "600" }),
        juez(2, { nombre: "Ana", zona: "SUR", nivel: "Nacional", estado: "Sancionado" }),
      );
      todos = await memoryReferees.getReferees({ user: NACIONAL });
      opciones = await memoryReferees.getRefereeOptions({ user: NACIONAL });
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    }
    expect(opciones.map((o) => o.id)).toEqual(["j1", "j2"]);
    expect(opciones).toEqual(
      todos.map((r) => ({ id: r.id, nombre: r.nombre, nivel: r.nivel, estado: r.estado })),
    );
    expect(Object.keys(opciones[0] ?? {}).sort()).toEqual(["estado", "id", "nivel", "nombre"]);
  });
});

// ── Soporte ─────────────────────────────────────────────────────────────────
const TICKET = {
  id: "t1",
  titulo: "No carga",
  descripcion: "x",
  categoria: "incidencia",
  status: "abierto",
  created_by_id: "u9",
  created_by_name: "Luis",
  created_at: "2026-02-01T10:00:00.000Z",
  updated_at: "2026-02-01T10:00:00.000Z",
};
const ADJUNTO = {
  id: "a1",
  ticket_id: "t1",
  comment_id: null,
  storage_path: "tickets/t1/a.png",
  file_name: "a.png",
  content_type: "image/png",
  size_bytes: 1,
  created_at: "2026-02-01T10:00:00.000Z",
};
const AUTOR: SessionUser = { ...NACIONAL, id: "u9", role: "solo_ver", rol: "Solo ver" };

describe("bandeja de soporte: recuento y adjuntos a la vez", () => {
  it("tres viajes en vez de cuatro, con el mismo resultado", async () => {
    respond = (c) => {
      if (c.table === "support_tickets") return ok([TICKET]);
      if (c.table === "support_ticket_comments") return ok([{ ticket_id: "t1" }, { ticket_id: "t1" }]);
      if (c.table === "support_ticket_attachments") return ok([ADJUNTO]);
      return ok([]);
    };
    const { value, waves } = await inWaves(() => ticketService.getTickets({ user: AUTOR }));
    // tickets → (comentarios ‖ adjuntos) → firma. Antes la firma esperaba a
    // los dos y los adjuntos esperaban al recuento.
    expect(waves).toBe(3);
    expect(value).toHaveLength(1);
    expect(value![0]!.commentCount).toBe(2);
    expect(value![0]!.attachments.map((a) => a.signedUrl)).toEqual([
      "https://firmada/tickets/t1/a.png",
    ]);
  });

  it("si fallan recuento y adjuntos, el error es el del recuento, como en serie", async () => {
    respond = (c) => {
      if (c.table === "support_tickets") return ok([TICKET]);
      if (c.table === "support_ticket_comments") return fail("connection reset");
      if (c.table === "support_ticket_attachments") return fail("otro fallo");
      return ok([]);
    };
    const { error } = await inWaves(() => ticketService.getTickets({ user: AUTOR }));
    expect(String(error)).toMatch(/support_ticket_comments: connection reset/);
  });
});

describe("detalle de un ticket: el hilo se pide a la vez que el ticket", () => {
  it("dos viajes en vez de tres (ticket ‖ hilo ‖ adjuntos, y la firma)", async () => {
    respond = (c) => {
      if (c.table === "support_tickets") return ok(TICKET);
      if (c.table === "support_ticket_comments") return ok([]);
      if (c.table === "support_ticket_attachments") return ok([ADJUNTO]);
      return ok([]);
    };
    const { value, waves } = await inWaves(() => ticketService.getTicket("t1", AUTOR));
    expect(waves).toBe(2);
    expect(value?.id).toBe("t1");
    expect(value?.attachments).toHaveLength(1);
  });

  it("un ticket ajeno sigue siendo undefined, aunque el hilo falle, y no se firma nada", async () => {
    respond = (c) => {
      if (c.table === "support_tickets") return ok({ ...TICKET, created_by_id: "otro" });
      if (c.table === "support_ticket_comments") return fail("connection reset");
      if (c.table === "support_ticket_attachments") return ok([ADJUNTO]);
      return ok([]);
    };
    const { value, error } = await inWaves(() => ticketService.getTicket("t1", AUTOR));
    expect(error).toBeUndefined();
    expect(value).toBeUndefined();
    expect(signed).toEqual([]);
  });

  it("la tabla sin migrar sigue dando undefined", async () => {
    respond = () => fail("does not exist", "42P01");
    const { value, error } = await inWaves(() => ticketService.getTicket("t1", AUTOR));
    expect(error).toBeUndefined();
    expect(value).toBeUndefined();
  });

  it("un hilo que no se puede leer sigue fallando en alto", async () => {
    respond = (c) => {
      if (c.table === "support_tickets") return ok(TICKET);
      if (c.table === "support_ticket_comments") return fail("connection reset");
      return ok([]);
    };
    const { error } = await inWaves(() => ticketService.getTicket("t1", AUTOR));
    expect(error).toMatchObject({ message: "connection reset" });
  });
});

// ── Páginas ─────────────────────────────────────────────────────────────────
// Vitest no compila el JSX de las páginas (tsconfig con `jsx: preserve`), así
// que, como en el barrido de PII de las páginas, se mira el código fuente.
const DASHBOARD = join(process.cwd(), "src/app/(dashboard)");
const fuente = (rel: string) => readFileSync(join(DASHBOARD, rel), "utf8");

describe("páginas que solo necesitan un desplegable de jueces", () => {
  it("ascensos, exámenes e informes ya no leen el censo entero", () => {
    for (const rel of ["promotions/page.tsx", "exams/page.tsx", "reports/page.tsx"]) {
      const src = fuente(rel);
      expect(src, rel).not.toMatch(/dataService\.getReferees\(/);
      expect(src, rel).toMatch(/dataService\.getRefereeOptions\(\{ user \}\)/);
    }
  });

  it("ascensos solo manda el censo a quien puede crear la solicitud", () => {
    const src = fuente("promotions/page.tsx");
    expect(src).toMatch(
      /canCreate \? dataService\.getRefereeOptions\(\{ user \}\) : Promise\.resolve\(\[\]\)/,
    );
    expect(src).toMatch(/canCreate=\{canCreate\}/);
  });
});

describe("usuarios: zonas y listado a la vez", () => {
  it("el listado no espera a las zonas, y su fallo sigue sin tumbar la página", () => {
    const src = fuente("admin/users/page.tsx");
    expect(src).toMatch(/await Promise\.all\(\[\s*dataService\.getMeta\(user\),\s*listAdminUsers\(\)\.catch\(/);
    expect(src).not.toMatch(/const meta = await dataService\.getMeta/);
  });
});
