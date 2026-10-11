import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysIso, todayIso } from "@/lib/business-date";
import type { Competition, Referee, RosterSession } from "@/lib/types";

// Rendimiento de la portada y del portal del juez: menos viajes a la base de
// datos con el MISMO resultado. Las reglas se prueban en memoria (contando
// llamadas al servicio); las lecturas de Supabase, con un cliente simulado
// que cuenta las peticiones.

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Row = Record<string, unknown>;
interface Peticion {
  table: string;
  select?: string;
  filters: [string, string, unknown][];
}
let peticiones: Peticion[] = [];
let responder: (p: Peticion) => { data: unknown; error: { message: string; code?: string } | null } = () => ({
  data: [],
  error: null,
});

function query(table: string) {
  const p: Peticion = { table, filters: [] };
  peticiones.push(p);
  const q: Record<string, unknown> = {};
  const run = () => responder(p);
  q.select = (cols: string) => ((p.select = cols), q);
  for (const op of ["eq", "neq", "in", "gte", "lte", "is"]) {
    q[op] = (c: string, v: unknown) => (p.filters.push([op, c, v]), q);
  }
  q.order = () => q;
  q.range = () => q;
  q.limit = () => q;
  q.maybeSingle = async () => {
    const r = run();
    return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
  };
  q.single = q.maybeSingle;
  q.then = (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(run()).then(resolve, reject);
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));

const { getStore, setCompetitionTemplate } = await import("@/server/store");
const conv = await import("@/server/convocatorias");
const { dataService } = await import("@/server/services");
const { convocatoriaService } = await import("@/server/services/supabase-convocatorias");
const { portalService } = await import("@/server/services/supabase-portal");

const S1: RosterSession = { sesion: "S1", nombre: "Sesión 1", dia: "", categorias: [], horarioCompeticion: "", horarioPesaje: "", roles: [{ rol: "Central", key: "central", slots: 1 }], pesajeRoles: [] };
const nacional = { id: "n", nombre: "Nacional", role: "super_admin" as const };
const delegadaMed = { id: "dm", nombre: "Delegada Med", role: "delegado_zona" as const, zona: "MEDITERRANEO" };
const delegadoCen = { id: "dc", nombre: "Delegado Centro", role: "delegado_zona" as const, zona: "CENTRO" };
const juez = (id: string, zona: string): Referee => ({ id, nombre: id, zona, nivel: "Nacional", estado: "Activo", eventos: 0, ultimo: "", disp: true, iniciales: "J" });
const fecha = addDaysIso(todayIso(), 30);
const comp = (id: string, patch: Partial<Competition> = {}): Competition => ({ id, nombre: id, tipo: "AEP-3", fecha, fechaFin: fecha, sede: "X", sesiones: 1, requeridos: 1, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "MEDITERRANEO", ...patch });

function nuevoCampeonato(id: string, patch: Partial<Competition> = {}) {
  const c = comp(id, patch);
  getStore().competitions.push(c);
  setCompetitionTemplate(c.id, [S1]);
  getStore().assignments.set(c.id, {});
  return c;
}

const lanzar = (actor: Parameters<typeof conv.crearConvocatoria>[0], c: Competition, extra = {}) =>
  conv.crearConvocatoria(actor, c, [S1], { sesiones: ["S1"], cierraEl: addDaysIso(todayIso(), 10), ...extra });

beforeEach(() => {
  const s = getStore();
  s.convocatorias = [];
  s.inscripciones = [];
  s.notificaciones = [];
  s.respuestas = new Map();
  s.competitions = s.competitions.filter((c) => !c.id.startsWith("pk-"));
  s.referees = s.referees.filter((r) => !r.id.startsWith("pk-"));
  s.referees.push(juez("pk-med", "MEDITERRANEO"), juez("pk-cen", "CENTRO"));
  peticiones = [];
  responder = () => ({ data: [], error: null });
});

afterEach(() => vi.restoreAllMocks());

describe("portada: peticiones de otras zonas", () => {
  it("lee cada convocatoria y cada campeonato una sola vez, y conserva el orden y los filtros", async () => {
    const a = nuevoCampeonato("pk-a", { nombre: "Open A" });
    const b = nuevoCampeonato("pk-b", { nombre: "Open B" });
    const cerrado = nuevoCampeonato("pk-c", { nombre: "Open C" });
    const ca = await lanzar(delegadaMed, a, { zonasExtra: ["CENTRO", "ANDALUCIA"] });
    const cb = await lanzar(delegadaMed, b, { zonasExtra: ["CENTRO"] });
    const cc = await lanzar(delegadaMed, cerrado, { zonasExtra: ["CENTRO"] });
    await conv.actualizarConvocatoria(cc, cerrado, [S1], { estado: "cerrada" });
    // Orden de `listZonasPendientes`: la más reciente primero.
    const store = getStore();
    const zona = (id: string, z: string) => store.convocatorias.find((x) => x.id === id)!.zonas.find((x) => x.zona === z)!;
    zona(ca.id, "CENTRO").solicitadaAt = "2026-01-03T00:00:00Z";
    zona(ca.id, "ANDALUCIA").solicitadaAt = "2026-01-01T00:00:00Z";
    zona(cb.id, "CENTRO").solicitadaAt = "2026-01-02T00:00:00Z";
    zona(cc.id, "CENTRO").solicitadaAt = "2026-01-04T00:00:00Z";

    const porIds = vi.spyOn(dataService, "listConvocatoriasPorIds");
    const una = vi.spyOn(dataService, "getConvocatoria");
    const tarima = vi.spyOn(dataService, "getCompetitionWithRoster");

    const out = await conv.solicitudesParaUsuario(nacional);
    // La de la convocatoria cerrada no se puede responder: fuera, como antes.
    expect(out.map((s) => [s.competitionName, s.zona])).toEqual([
      ["Open A", "CENTRO"],
      ["Open B", "CENTRO"],
      ["Open A", "ANDALUCIA"],
    ]);
    expect(out[0]).toMatchObject({ competitionId: a.id, cierraEl: ca.cierraEl, fecha: a.fecha, competitionZona: "MEDITERRANEO" });
    expect(porIds).toHaveBeenCalledTimes(1);
    expect(una).not.toHaveBeenCalled();
    // Un campeonato por convocatoria ABIERTA, aunque tenga dos peticiones; el
    // de la cerrada ni se lee.
    expect(tarima.mock.calls.map(([id]) => id).sort()).toEqual([a.id, b.id]);

    // Un delegado de zona solo ve las de la suya.
    expect((await conv.solicitudesParaUsuario(delegadoCen)).map((s) => s.competitionName)).toEqual(["Open A", "Open B"]);
  });

  it("sin peticiones pendientes no lee nada más, y un campeonato ya pasado no sale", async () => {
    const porIds = vi.spyOn(dataService, "listConvocatoriasPorIds");
    expect(await conv.solicitudesParaUsuario(nacional)).toEqual([]);
    expect(porIds).not.toHaveBeenCalled();

    const a = nuevoCampeonato("pk-a");
    await lanzar(delegadaMed, a, { zonasExtra: ["CENTRO"] });
    a.fecha = addDaysIso(todayIso(), -3);
    a.fechaFin = a.fecha;
    expect(await conv.solicitudesParaUsuario(nacional)).toEqual([]);
  });

  it("un fallo de lectura sigue llegando a la página (que lo captura)", async () => {
    const a = nuevoCampeonato("pk-a");
    await lanzar(delegadaMed, a, { zonasExtra: ["CENTRO"] });
    vi.spyOn(dataService, "getCompetitionWithRoster").mockRejectedValue(new Error("timeout"));
    await expect(conv.solicitudesParaUsuario(nacional)).rejects.toThrow("timeout");
  });
});

describe("portal: convocatorias del juez", () => {
  it("la ficha se lee una vez y la sanción, a la vez que las vistas", async () => {
    const a = nuevoCampeonato("pk-a");
    const b = nuevoCampeonato("pk-b", { fecha: addDaysIso(todayIso(), 20), fechaFin: addDaysIso(todayIso(), 20) });
    await lanzar(delegadaMed, a);
    await lanzar(delegadaMed, b);
    const ficha = vi.spyOn(dataService, "getReferee");
    const sancion = vi.spyOn(dataService, "getActiveSanction");
    const lista = await conv.convocatoriasParaJuez("pk-med");
    // Mismo orden de antes: por fecha del campeonato.
    expect(lista.map((x) => x.competitionId)).toEqual([b.id, a.id]);
    expect(ficha).toHaveBeenCalledTimes(1);
    expect(sancion).toHaveBeenCalledTimes(1);
  });

  it("sin convocatorias abiertas no se lee la sanción (su fallo no tumba la lista vacía)", async () => {
    const sancion = vi.spyOn(dataService, "getActiveSanction").mockRejectedValue(new Error("timeout"));
    expect(await conv.convocatoriasParaJuez("pk-med")).toEqual([]);
    expect(sancion).not.toHaveBeenCalled();
  });

  it("una convocatoria que no llega a su zona es null sin leer nada más", async () => {
    const a = nuevoCampeonato("pk-a");
    const c = await lanzar(delegadaMed, a);
    const sancion = vi.spyOn(dataService, "getActiveSanction").mockRejectedValue(new Error("timeout"));
    const tarima = vi.spyOn(dataService, "getCompetitionWithRoster");
    expect(await conv.convocatoriaParaJuez("pk-cen", c.id)).toBeNull();
    expect(sancion).not.toHaveBeenCalled();
    expect(tarima).not.toHaveBeenCalled();
    // La suya sí, y con la sanción leída falla como antes.
    await expect(conv.convocatoriaParaJuez("pk-med", c.id)).rejects.toThrow("timeout");
  });

  it("un campeonato ya pasado no se enseña aunque falle el mapa de ocupación", async () => {
    const a = nuevoCampeonato("pk-a");
    const c = await lanzar(delegadaMed, a);
    a.fecha = addDaysIso(todayIso(), -3);
    a.fechaFin = a.fecha;
    vi.spyOn(dataService, "getRefereeBusyMap").mockRejectedValue(new Error("timeout"));
    expect(await conv.convocatoriaParaJuez("pk-med", c.id)).toBeNull();
  });

  describe("aviso de fechas ya designadas", () => {
    let c: Awaited<ReturnType<typeof lanzar>>;
    let x: Competition;
    let y: Competition;
    beforeEach(async () => {
      const a = nuevoCampeonato("pk-a");
      c = await lanzar(delegadaMed, a);
      x = nuevoCampeonato("pk-x", { nombre: "Campeonato X" });
      y = nuevoCampeonato("pk-y", { nombre: "Campeonato Y" });
      getStore().assignments.set(x.id, { S1_central_0: "pk-med" });
      getStore().assignments.set(y.id, { S1_central_0: "pk-med" });
    });

    it("solo cuenta tarimas aprobadas y elige la primera del mapa, como antes", async () => {
      expect((await conv.convocatoriaParaJuez("pk-med", c.id))!.aviso).toBeUndefined();
      y.aprobacion = "Aprobado";
      expect((await conv.convocatoriaParaJuez("pk-med", c.id))!.aviso).toMatch(/Campeonato Y/);
      x.aprobacion = "Aprobado";
      expect((await conv.convocatoriaParaJuez("pk-med", c.id))!.aviso).toMatch(/Campeonato X/);
    });

    it("las tarimas se leen a la vez, pero un fallo solo cuenta si el bucle de antes llegaba a él", async () => {
      x.aprobacion = "Aprobado";
      const original = dataService.getCompetition;
      const lectura = vi.spyOn(dataService, "getCompetition").mockImplementation(async (id: string) => {
        if (id === y.id) throw new Error("timeout");
        return original(id);
      });
      // X (la primera) está aprobada: el bucle paraba ahí y nunca leía Y.
      expect((await conv.convocatoriaParaJuez("pk-med", c.id))!.aviso).toMatch(/Campeonato X/);
      expect(lectura).toHaveBeenCalledTimes(2);
      // Si X no está aprobada, el bucle llegaba a Y: su fallo se propaga.
      x.aprobacion = "Sin propuesta";
      await expect(conv.convocatoriaParaJuez("pk-med", c.id)).rejects.toThrow("timeout");
    });
  });
});

describe("Supabase: convocatorias con sus zonas en una sola lectura", () => {
  const fila = (id: string): Row => ({
    id,
    competition_id: `comp-${id}`,
    estado: "abierta",
    sesiones: ["S1"],
    cierra_el: "2026-12-01",
    convocatoria_zonas: [
      { convocatoria_id: id, zona: "MEDITERRANEO", estado: "aceptada", origen: "propia" },
      { convocatoria_id: id, zona: "CENTRO", estado: "pendiente", origen: "automatica", solicitada_at: "2026-11-01T00:00:00Z" },
    ],
  });

  it("getConvocatoria: un viaje, zonas embebidas", async () => {
    responder = (p) => ({ data: p.table === "convocatorias" ? [fila("c1")] : [], error: null });
    const c = await convocatoriaService.getConvocatoria("c1");
    expect(peticiones.map((p) => p.table)).toEqual(["convocatorias"]);
    expect(peticiones[0]!.select).toMatch(/convocatoria_zonas\(\*\)/);
    expect(c).toMatchObject({ id: "c1", competitionId: "comp-c1", cierraEl: "2026-12-01" });
    expect(c!.zonas.map((z) => [z.zona, z.estado])).toEqual([
      ["MEDITERRANEO", "aceptada"],
      ["CENTRO", "pendiente"],
    ]);
  });

  it("getConvocatoria: ninguna fila es null; un error se lanza", async () => {
    responder = () => ({ data: [], error: null });
    expect(await convocatoriaService.getConvocatoria("nada")).toBeNull();
    responder = () => ({ data: null, error: { message: "boom" } });
    await expect(convocatoriaService.getConvocatoria("c1")).rejects.toThrow("convocatorias: boom");
  });

  it("getLiveConvocatoria: un viaje", async () => {
    responder = () => ({ data: [fila("c1")], error: null });
    const c = await convocatoriaService.getLiveConvocatoria("comp-c1");
    expect(peticiones).toHaveLength(1);
    expect(c!.zonas).toHaveLength(2);
  });

  it("abiertas para una zona: dos viajes (antes tres) y todas las zonas de cada una", async () => {
    responder = (p) =>
      p.table === "convocatoria_zonas"
        ? { data: [{ convocatoria_id: "c1" }, { convocatoria_id: "c2" }], error: null }
        : { data: [fila("c1"), fila("c2")], error: null };
    const list = await convocatoriaService.listConvocatoriasAbiertasParaZona("MEDITERRANEO", "2026-10-01");
    expect(peticiones.map((p) => p.table)).toEqual(["convocatoria_zonas", "convocatorias"]);
    expect(peticiones[1]!.filters).toEqual(
      expect.arrayContaining([
        ["in", "id", ["c1", "c2"]],
        ["eq", "estado", "abierta"],
        ["gte", "cierra_el", "2026-10-01"],
      ]),
    );
    expect(list.map((c) => c.zonas.length)).toEqual([2, 2]);
  });

  it("por ids: una lectura sin repetir ids; sin ids, ninguna", async () => {
    expect(await convocatoriaService.listConvocatoriasPorIds([])).toEqual([]);
    expect(peticiones).toHaveLength(0);
    responder = () => ({ data: [fila("c1"), fila("c2")], error: null });
    const list = await convocatoriaService.listConvocatoriasPorIds(["c1", "c2", "c1"]);
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]!.filters).toContainEqual(["in", "id", ["c1", "c2"]]);
    expect(list.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(list[0]!.zonas).toHaveLength(2);
  });
});

describe("Supabase: portal del juez en una tanda", () => {
  const template: RosterSession[] = [{ ...S1, nombre: "Mañana" }];
  const futuro = addDaysIso(todayIso(), 15);
  const pasado = addDaysIso(todayIso(), -40);
  const competitions: Row[] = [
    { id: "k1", nombre: "Aprobado", tipo: "AEP-3", fecha: futuro, fecha_fin: futuro, sede: "A", aprobacion: "Aprobado", template, roster_assignments: [{ slot_key: "S1_central_0" }] },
    { id: "k2", nombre: "Borrador", tipo: "AEP-3", fecha: futuro, fecha_fin: futuro, sede: "B", aprobacion: "Sin propuesta", template, roster_assignments: [{ slot_key: "S1_central_0" }] },
    { id: "k3", nombre: "Pasado", tipo: "AEP-3", fecha: pasado, fecha_fin: pasado, sede: "C", aprobacion: "Aprobado", template, roster_assignments: [{ slot_key: "S1_central_0" }] },
  ];

  it("ficha, campeonatos (con sus huecos) y sanción a la vez: sin leer roster_assignments aparte", async () => {
    responder = (p) => {
      if (p.table === "referees") return { data: [{ id: "j1", nombre: "Ana Roa", zona: "CENTRO", nivel: "Nacional", estado: "Activo" }], error: null };
      if (p.table === "competitions") return { data: competitions, error: null };
      return { data: [], error: null };
    };
    const portal = await portalService.getJudgePortal("j1");
    expect(peticiones.map((p) => p.table).sort()).toEqual(["competitions", "referee_sanctions", "referees"]);
    const lectura = peticiones.find((p) => p.table === "competitions")!;
    expect(lectura.select).toMatch(/roster_assignments!inner\(slot_key\)/);
    // Solo SUS huecos: el filtro va sobre el embebido.
    expect(lectura.filters).toContainEqual(["eq", "roster_assignments.referee_id", "j1"]);
    expect(portal!.profile).toMatchObject({ id: "j1", nombre: "Ana Roa" });
    // Un borrador no se enseña; el pasado va al historial.
    expect(portal!.upcoming.map((d) => d.competitionId)).toEqual(["k1"]);
    expect(portal!.upcoming[0]!.sessions).toEqual([
      expect.objectContaining({ session: "S1", nombre: "Mañana", roles: [expect.any(String)] }),
    ]);
    expect(portal!.past.map((d) => d.competitionId)).toEqual(["k3"]);
  });

  it("sin ficha es undefined; un fallo al leer sus campeonatos se lanza (no «sin designaciones»)", async () => {
    responder = () => ({ data: [], error: null });
    expect(await portalService.getJudgePortal("nadie")).toBeUndefined();
    responder = (p) =>
      p.table === "competitions"
        ? { data: null, error: { message: "boom" } }
        : { data: p.table === "referees" ? [{ id: "j1", nombre: "Ana" }] : [], error: null };
    await expect(portalService.getJudgePortal("j1")).rejects.toThrow(/roster_assignments\/competitions: boom/);
  });
});
