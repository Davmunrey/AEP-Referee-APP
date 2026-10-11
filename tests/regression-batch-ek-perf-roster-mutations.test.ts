import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RosterPaidClaimError,
  RosterSlotConflictError,
  RosterTemplateConflictError,
} from "@/lib/competitions/service-types";
import { rosterTemplateHash } from "@/lib/roster-template-hash";
import type { Competition, RosterSession } from "@/lib/types";

// Rendimiento de las mutaciones de la tarima (liberar hueco, plantilla,
// marcadores, enviar y borrador). Cada round-trip a PostgREST cuesta lo mismo
// que el anterior, así que lo que se mide aquí es la PROFUNDIDAD de la cadena
// de esperas: dos consultas lanzadas a la vez cuentan como un solo nivel. Y,
// junto a cada recorte, lo que no podía cambiar: qué error gana, que no se
// escribe nada cuando se corta y que cobertura e historial quedan escritos
// antes de responder.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

type Row = Record<string, unknown>;
type Err = { code?: string; message: string };
type Logged = { table: string; op: string; level: number; payload?: unknown; probe: boolean };

const tables: Record<string, Row[]> = {};
/** `${tabla}.${op}` → error que devuelve esa consulta. */
let failOn: Record<string, Err>;
let log: Logged[];
/** Nivel más alto ya resuelto: una consulta que arranca después va un nivel más abajo. */
let completed: number;

function query(table: string) {
  const rows = () => (tables[table] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op = "select";
  let payload: unknown;
  let probe = false;
  const exec = (mode: "many" | "single" | "maybe") => {
    const level = completed + 1;
    log.push({ table, op, level, payload, probe });
    return new Promise((resolve) =>
      setTimeout(() => {
        completed = Math.max(completed, level);
        const error = failOn[`${table}.${op}`] ?? null;
        if (error) return resolve({ data: null, error });
        const hit = rows().filter((r) => filters.every((f) => f(r)));
        if (op === "update") for (const r of hit) Object.assign(r, payload as Row);
        if (op === "delete") tables[table] = rows().filter((r) => !hit.includes(r));
        if (op === "insert") {
          const list = Array.isArray(payload) ? payload : [payload];
          rows().push(...list.map((r) => ({ ...(r as Row) })));
          return resolve({ data: null, error: null });
        }
        if (mode === "single") {
          return resolve(
            hit[0]
              ? { data: hit[0], error: null }
              : { data: null, error: { code: "PGRST116", message: "0 rows" } },
          );
        }
        if (mode === "maybe") return resolve({ data: hit[0] ?? null, error: null });
        resolve({ data: hit, error: null });
      }, 1),
    );
  };
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), q);
  q.in = (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q);
  q.order = () => q;
  q.limit = () => ((probe = true), q);
  q.update = (p: unknown) => ((op = "update"), (payload = p), q);
  q.insert = (p: unknown) => ((op = "insert"), (payload = p), q);
  q.delete = () => ((op = "delete"), q);
  q.single = () => exec("single");
  q.maybeSingle = () => exec("maybe");
  q.then = (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    exec("many").then(resolve, reject);
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: query }),
}));

const { rosterService } = await import("@/server/services/supabase-roster");
const { createAdminClient } = await import("@/lib/supabase/admin");

function sesion(codigo: string, slots = 2): RosterSession {
  return {
    sesion: codigo,
    nombre: `Sesión ${codigo}`,
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-74" }],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ key: "central", rol: "Central", slots }],
    pesajeRoles: [],
  };
}

/** Lee la fila como lo hace getCompetitionRow: una consulta, un nivel. */
const getComp = async (id: string): Promise<Competition | undefined> => {
  const { data } = (await createAdminClient()
    .from("competitions")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: Row | null };
  return data ? (data as unknown as Competition) : undefined;
};

function seed(opts: { paid?: string[]; template?: RosterSession[]; estado?: string } = {}) {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.competitions = [
    {
      id: "c1",
      nombre: "Copa",
      tipo: "AEP-2",
      zona: "CENTRO",
      template: opts.template ?? [sesion("S1")],
      requeridos: 2,
      sesiones: 1,
      estado: opts.estado ?? "Completo",
      aprobacion: "pendiente",
    },
  ];
  tables.roster_assignments = [
    { competition_id: "c1", slot_key: "S1_central_0", referee_id: "j1", flags: {}, cross_zone: false },
    { competition_id: "c1", slot_key: "S1_central_1", referee_id: "j2", flags: {}, cross_zone: false },
  ];
  tables.judge_compensation_claims = (opts.paid ?? []).map((id) => ({
    competition_id: "c1",
    referee_id: id,
    status: "pagado",
  }));
}

const depth = () => Math.max(0, ...log.filter((l) => !l.probe).map((l) => l.level));
const writes = () =>
  log.filter((l) => l.op !== "select").map((l) => `${l.table}.${l.op}`);
const history = () => (tables.roster_history ?? []).map((r) => r.action);
const competitionUpdates = () =>
  log.filter((l) => l.table === "competitions" && l.op === "update").map((l) => l.payload as Row);

function reset() {
  failOn = {};
  log = [];
  completed = 0;
}

beforeAll(async () => {
  // Las sondas de columnas se cachean por instancia: se calientan una vez para
  // medir el caso normal (instancia caliente), no el arranque en frío.
  reset();
  seed();
  await rosterService.submitRoster("c1", "warm", "u0", getComp);
});

beforeEach(() => {
  reset();
  seed();
});

describe("clearSlot: una sola foto del hueco", () => {
  it("libera el hueco, recalcula la cobertura y deja el acta antes de responder", async () => {
    const result = await rosterService.clearSlot("c1", "S1_central_0", "Ana", "j1");
    expect(result).toEqual({ S1_central_1: "j2" });
    expect(tables.roster_assignments!.map((r) => r.slot_key)).toEqual(["S1_central_1"]);
    expect(history()).toEqual(["Liberó slot"]);
    expect(competitionUpdates()).toEqual([
      { confirmados: 1, requeridos: 2, estado: expect.any(String) },
    ]);
  });

  it("lee la tarima una vez antes de borrar (antes, dos lecturas idénticas en serie)", async () => {
    await rosterService.clearSlot("c1", "S1_central_0", "Ana", "j1");
    const deleteIndex = log.findIndex((l) => l.op === "delete");
    const readsBefore = log
      .slice(0, deleteIndex)
      .filter((l) => l.table === "roster_assignments" && l.op === "select");
    expect(readsBefore).toHaveLength(1);
    // Foto + pagos | borrado | relectura + cobertura + acta | escritura de la
    // cobertura. Antes eran ocho niveles.
    expect(depth()).toBeLessThanOrEqual(4);
  });

  it("un 409 sigue ganando aunque la tabla de pagos falle, y no escribe nada", async () => {
    failOn["judge_compensation_claims.select"] = { message: "connection reset" };
    await expect(
      rosterService.clearSlot("c1", "S1_central_0", "Ana", "j9"),
    ).rejects.toBeInstanceOf(RosterSlotConflictError);
    await expect(
      rosterService.clearSlot("c1", "S1_central_0", "Ana", null),
    ).rejects.toThrow(/mientras lo editabas/);
    expect(writes()).toEqual([]);
  });

  it("con el ocupante pagado se corta (423) sin escribir", async () => {
    seed({ paid: ["j1"] });
    await expect(
      rosterService.clearSlot("c1", "S1_central_0", "Ana", "j1"),
    ).rejects.toBeInstanceOf(RosterPaidClaimError);
    expect(writes()).toEqual([]);
  });

  it("si no se sabe si hay pago, tampoco se borra", async () => {
    failOn["judge_compensation_claims.select"] = { message: "connection reset" };
    await expect(rosterService.clearSlot("c1", "S1_central_0", "Ana", "j1")).rejects.toThrow(
      /judge_compensation_claims/,
    );
    expect(writes()).toEqual([]);
  });

  it("un hueco ya vacío no necesita la tabla de pagos: su fallo no corta nada", async () => {
    tables.roster_assignments = tables.roster_assignments!.filter((r) => r.slot_key !== "S1_central_0");
    failOn["judge_compensation_claims.select"] = { message: "connection reset" };
    const result = await rosterService.clearSlot("c1", "S1_central_0", "Ana", null);
    expect(result).toEqual({ S1_central_1: "j2" });
    expect(writes()).not.toContain("roster_assignments.delete");
    expect(history()).toEqual(["Liberó slot"]);
  });
});

describe("saveCompetitionTemplate: lecturas en paralelo y un único UPDATE", () => {
  it("guarda plantilla y sesiones juntas, y la cobertura con la plantilla guardada", async () => {
    const plantilla = [sesion("S1"), sesion("S2", 1)];
    const result = await rosterService.saveCompetitionTemplate(
      "c1",
      plantilla,
      "Ana",
      getComp,
      rosterTemplateHash([sesion("S1")]),
    );
    expect(result?.assignments).toEqual({ S1_central_0: "j1", S1_central_1: "j2" });
    const updates = competitionUpdates();
    expect(updates[0]).toEqual({ template: plantilla, sesiones: 2 });
    // 3 huecos en la plantilla nueva, 2 ocupados.
    expect(updates[1]).toEqual({ confirmados: 2, requeridos: 3, estado: expect.any(String) });
    expect(updates).toHaveLength(2);
    expect(tables.competitions![0]!.sesiones).toBe(2);
    expect(history()).toEqual(["Plantilla actualizada"]);
    // La cobertura relee la plantilla DESPUÉS de escribirla: con dos guardados
    // a la vez cuenta la que queda en la base, no la de esta petición.
    const writeIndex = log.findIndex((l) => l.table === "competitions" && l.op === "update");
    expect(
      log.slice(writeIndex + 1).some((l) => l.table === "competitions" && l.op === "select"),
    ).toBe(true);
    // Lecturas | plantilla | relectura | cobertura (relee) + acta | escribe. Antes, nueve.
    expect(depth()).toBeLessThanOrEqual(5);
  });

  it("quitar una sesión borra sus huecos y la cobertura cuenta solo lo que queda", async () => {
    const result = await rosterService.saveCompetitionTemplate("c1", [sesion("S1", 1)], "Ana", getComp);
    expect(result?.assignments).toEqual({ S1_central_0: "j1" });
    expect(tables.roster_assignments!.map((r) => r.slot_key)).toEqual(["S1_central_0"]);
    expect(competitionUpdates()[1]).toEqual({ confirmados: 1, requeridos: 1, estado: expect.any(String) });
  });

  it("borrar la plantilla usa los requeridos guardados como antes", async () => {
    await rosterService.saveCompetitionTemplate("c1", [], "Ana", getComp);
    const updates = competitionUpdates();
    expect(updates[0]).toEqual({ template: [], sesiones: 0 });
    expect(updates[1]).toEqual({ confirmados: 0, requeridos: 2, estado: expect.any(String) });
  });

  it("si el campeonato no existe devuelve undefined aunque las otras lecturas fallen", async () => {
    tables.competitions = [];
    failOn["roster_assignments.select"] = { message: "network" };
    await expect(
      rosterService.saveCompetitionTemplate("c1", [], "Ana", getComp, rosterTemplateHash([])),
    ).resolves.toBeUndefined();
    expect(writes()).toEqual([]);
  });

  it("la huella vieja es un 409 antes que un fallo al listar las asignaciones", async () => {
    failOn["roster_assignments.select"] = { message: "network" };
    await expect(
      rosterService.saveCompetitionTemplate("c1", [], "Ana", getComp, rosterTemplateHash([])),
    ).rejects.toBeInstanceOf(RosterTemplateConflictError);
    expect(writes()).toEqual([]);
  });

  it("el fallo del UPDATE único sigue diciendo competitions.template y para ahí", async () => {
    failOn["competitions.update"] = { message: "permission denied" };
    await expect(
      rosterService.saveCompetitionTemplate("c1", [sesion("S1", 1)], "Ana", getComp),
    ).rejects.toThrow(/competitions\.template/);
    expect(writes()).toEqual(["competitions.update"]);
  });
});

describe("setSlotFlags", () => {
  it("relee y escribe el acta a la vez", async () => {
    const result = await rosterService.setSlotFlags(
      "c1",
      "S1_central_0",
      { compartido: true },
      "Ana",
    );
    expect(result).toEqual({
      flags: { S1_central_0: { compartido: true, intercambio: false } },
    });
    expect(history()).toEqual(["Flags slot"]);
    // Lecturas | escritura | relectura + acta. Antes, cuatro.
    expect(depth()).toBeLessThanOrEqual(3);
  });
});

describe("submitRoster y saveDraft", () => {
  it("envía la propuesta con actividad y acta escritas, en menos esperas", async () => {
    const proposal = await rosterService.submitRoster("c1", "Ana", "u1", getComp);
    expect(proposal?.status).toBe("pendiente");
    expect(tables.competitions![0]!.aprobacion).toBe("Propuesta enviada");
    expect(history()).toContain("Propuesta enviada a aprobación");
    expect((tables.activity_log ?? []).length).toBeGreaterThan(0);
    // Campeonato + tarima | ¿pendiente? | alta | estado | actividad + acta +
    // relectura. Antes, ocho.
    expect(depth()).toBeLessThanOrEqual(5);
  });

  it("si el campeonato no existe no se envía nada aunque la tarima falle", async () => {
    tables.competitions = [];
    failOn["roster_assignments.select"] = { message: "network" };
    await expect(rosterService.submitRoster("c1", "Ana", "u1", getComp)).resolves.toBeUndefined();
    expect(writes()).toEqual([]);
  });

  it("el borrador marca «Incompleto» y deja el acta en el mismo nivel", async () => {
    seed({ estado: "Borrador" });
    await rosterService.saveDraft("c1", "Ana", getComp);
    expect(tables.competitions![0]!.estado).toBe("Incompleto");
    expect(history()).toEqual(["Guardó borrador"]);
    expect(depth()).toBeLessThanOrEqual(2);
  });

  it("un borrador que ya no es «Borrador» solo deja el acta", async () => {
    await rosterService.saveDraft("c1", "Ana", getComp);
    expect(writes()).toEqual(["roster_history.insert"]);
  });
});
