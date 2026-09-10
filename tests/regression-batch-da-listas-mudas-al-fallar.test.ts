import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cuando una lectura se cae, la lista tiene que decir QUÉ se cayó.
 *
 * Los servicios de esta aplicación lanzan a propósito cuando no pueden leer:
 * una pantalla vacía es una afirmación sobre la temporada («no hay
 * campeonatos», «nadie ha confirmado») y no puede salir de un corte de red.
 * Pero seis rutas de esta misma API se quedaron sin `catch`:
 *
 *     return jsonOk(await dataService.getCompetitions(user));
 *
 * Así, la excepción salía de Next como un 500 sin el sobre `{ data } /
 * `{ error }` que espera el cliente —enseñaba el texto genérico por código de
 * estado, el mismo para las seis— y en el servidor no quedaba ni una línea
 * diciendo cuál de las lecturas había fallado. Sus hermanas de esta misma API
 * (aprobaciones, tickets, la ficha del juez) sí lo tenían.
 */

const requireApiUser = vi.fn();
const svc = {
  getCompetitions: vi.fn(),
  getPromotions: vi.fn(),
  getReferees: vi.fn(),
  getExams: vi.fn(),
  getReports: vi.fn(),
  getCompetitionAvailability: vi.fn(),
};

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: new Proxy(svc as Record<string, unknown>, {
    get: (target, prop: string) => target[prop] ?? (() => undefined),
  }),
}));
vi.mock("@/lib/api/referee-scope", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertCompetitionInUserZone: async () => null,
}));

const { GET: listarCampeonatos } = await import("@/app/api/v1/competitions/route");
const { GET: listarAscensos } = await import("@/app/api/v1/promotions/route");
const { GET: listarJueces } = await import("@/app/api/v1/referees/route");
const { GET: listarExamenes } = await import("@/app/api/v1/exams/route");
const { GET: listarInformes } = await import("@/app/api/v1/reports/route");
const { GET: listarConfirmaciones } = await import(
  "@/app/api/v1/competitions/[id]/availability/route"
);
const { PATCH: editarExamen } = await import("@/app/api/v1/exams/[id]/route");

const ADMIN = {
  id: "u1",
  nombre: "Admin",
  iniciales: "AD",
  email: "a@aep.test",
  rol: "Super Admin",
  role: "super_admin" as const,
};

const req = (url = "http://localhost/x") => new Request(url);
const ctx = { params: Promise.resolve({ id: "evt-1" }) };

async function sobre(res: Response) {
  return {
    status: res.status,
    tipo: res.headers.get("content-type") ?? "",
    body: (await res.json()) as { error?: string; data?: unknown },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue(ADMIN);
  for (const fn of Object.values(svc)) fn.mockReset();
});

const CASOS: {
  nombre: string;
  lectura: keyof typeof svc;
  llamar: () => Promise<Response>;
  mensaje: string;
}[] = [
  {
    nombre: "el calendario",
    lectura: "getCompetitions",
    llamar: () => listarCampeonatos(),
    mensaje: "No se pudo cargar el calendario",
  },
  {
    nombre: "los ascensos",
    lectura: "getPromotions",
    llamar: () => listarAscensos(),
    mensaje: "No se pudieron cargar los ascensos",
  },
  {
    nombre: "el censo",
    lectura: "getReferees",
    llamar: () => listarJueces(req()),
    mensaje: "No se pudo cargar el censo",
  },
  {
    nombre: "los exámenes",
    lectura: "getExams",
    llamar: () => listarExamenes(req()),
    mensaje: "No se pudieron cargar los exámenes",
  },
  {
    nombre: "los informes",
    lectura: "getReports",
    llamar: () => listarInformes(req()),
    mensaje: "No se pudieron cargar los informes",
  },
  {
    nombre: "las confirmaciones de disponibilidad",
    lectura: "getCompetitionAvailability",
    llamar: () => listarConfirmaciones(req(), ctx),
    mensaje: "No se pudieron cargar las confirmaciones",
  },
];

describe("una lista que no se puede leer", () => {
  for (const caso of CASOS) {
    it(`${caso.nombre}: responde con el sobre de error y su motivo`, async () => {
      svc[caso.lectura].mockRejectedValue(new Error("connection reset by peer"));
      const { status, tipo, body } = await sobre(await caso.llamar());
      expect(status).toBe(500);
      expect(tipo).toContain("application/json");
      expect(body.error).toBe(caso.mensaje);
    });

    it(`${caso.nombre}: no filtra el detalle interno del fallo`, async () => {
      svc[caso.lectura].mockRejectedValue(new Error("relation «referees» does not exist"));
      const { body } = await sobre(await caso.llamar());
      expect(body.error).not.toContain("does not exist");
    });
  }

  it("cada lista trae su propio motivo, no uno genérico compartido", async () => {
    const mensajes = new Set(CASOS.map((c) => c.mensaje));
    expect(mensajes.size).toBe(CASOS.length);
  });
});

describe("cuando la lectura va bien", () => {
  it("el calendario sigue devolviendo la lista tal cual", async () => {
    svc.getCompetitions.mockResolvedValue([{ id: "evt-1", nombre: "Campeonato" }]);
    const res = await listarCampeonatos();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string }[] };
    expect(body.data).toEqual([{ id: "evt-1", nombre: "Campeonato" }]);
  });

  it("las confirmaciones vacías siguen siendo una lista vacía, no un error", async () => {
    svc.getCompetitionAvailability.mockResolvedValue([]);
    const res = await listarConfirmaciones(req(), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { confirmedIds: string[] } };
    expect(body.data.confirmedIds).toEqual([]);
  });
});

/**
 * La misma regla en la lectura que decide un 404: si no se puede leer la lista
 * de exámenes visibles, el examen no es que «no exista».
 */
describe("editar un examen cuando no se puede leer cuáles son visibles", () => {
  it("no lo llama «Examen no encontrado»", async () => {
    svc.getExams.mockRejectedValue(new Error("timeout"));
    const res = await editarExamen(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ resultado: "Aprobado" }),
      }),
      { params: Promise.resolve({ id: "ex-1" }) },
    );
    const { status, body } = await sobre(res);
    expect(status).toBe(500);
    expect(body.error).toBe("No se pudieron cargar los exámenes");
  });

  it("y sigue devolviendo 404 cuando la lista se lee y el examen no está", async () => {
    svc.getExams.mockResolvedValue([{ id: "otro" }]);
    const res = await editarExamen(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ resultado: "Aprobado" }),
      }),
      { params: Promise.resolve({ id: "ex-1" }) },
    );
    const { status, body } = await sobre(res);
    expect(status).toBe(404);
    expect(body.error).toBe("Examen no encontrado");
  });
});

/**
 * Las otras dos lecturas sueltas del mismo tipo: la que decide si un informe
 * existe (y de qué zona es) y la que comprueba si el juez tiene una sanción
 * viva antes de reactivarlo.
 */
const { DELETE: borrarInforme } = await import("@/app/api/v1/reports/[id]/route");
const { PATCH: editarJuez } = await import("@/app/api/v1/referees/[id]/route");

describe("lecturas sueltas que deciden un permiso", () => {
  it("borrar un informe: un fallo de lectura no es «Informe no encontrado»", async () => {
    (svc as Record<string, ReturnType<typeof vi.fn>>).getReport = vi
      .fn()
      .mockRejectedValue(new Error("timeout"));
    const res = await borrarInforme(req(), { params: Promise.resolve({ id: "rep-1" }) });
    const { status, body } = await sobre(res);
    expect(status).toBe(500);
    expect(body.error).toBe("No se pudo cargar el informe");
  });

  it("reactivar un juez: si no se puede leer su sanción, se dice", async () => {
    const s = svc as Record<string, ReturnType<typeof vi.fn>>;
    s.getReferee = vi.fn().mockResolvedValue({ id: "j-1", nombre: "Ana", zona: "CENTRO" });
    s.getActiveSanction = vi.fn().mockRejectedValue(new Error("timeout"));
    const res = await editarJuez(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ estado: "Activo" }),
      }),
      { params: Promise.resolve({ id: "j-1" }) },
    );
    const { status, body } = await sobre(res);
    expect(status).toBe(500);
    expect(body.error).toBe("No se pudo comprobar si el juez tiene una sanción activa");
  });
});
