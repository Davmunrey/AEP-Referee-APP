import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysIso, todayIso } from "@/lib/business-date";
import type { Competition, Referee, RefereeSanction, RosterSession } from "@/lib/types";

// Convocatorias (memoria): las reglas viven en `server/convocatorias` y son
// las mismas para Supabase, que solo cambia el almacenamiento.

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const { getStore, setCompetitionTemplate } = await import("@/server/store");
const conv = await import("@/server/convocatorias");

const template: RosterSession[] = [
  { sesion: "S1", nombre: "Sesión 1", dia: "Sábado", categorias: [], horarioCompeticion: "10:00", horarioPesaje: "08:00", roles: [{ rol: "Central", key: "central", slots: 1 }], pesajeRoles: [] },
  { sesion: "S2", nombre: "Sesión 2", dia: "Sábado", categorias: [], horarioCompeticion: "16:00", horarioPesaje: "14:00", roles: [{ rol: "Lateral", key: "lateral", slots: 2 }], pesajeRoles: [] },
];
const fecha = addDaysIso(todayIso(), 30);
const cierre = addDaysIso(todayIso(), 10);
const actor = { id: "u", nombre: "Delegada" };

function juez(id: string, zona: string, patch: Partial<Referee> = {}): Referee {
  return { id, nombre: id, zona, nivel: "Regional", estado: "Activo", eventos: 0, ultimo: "", disp: true, iniciales: "J", ...patch };
}

let competition: Competition;
beforeEach(() => {
  const s = getStore();
  s.convocatorias = [];
  s.inscripciones = [];
  s.sanctions = [];
  s.competitions = s.competitions.filter((c) => !c.id.startsWith("cv-"));
  s.referees = s.referees.filter((r) => !r.id.startsWith("cv-"));
  competition = { id: "cv-1", nombre: "Open Valencia", tipo: "AEP-3", fecha, fechaFin: fecha, sede: "Valencia", sesiones: 2, requeridos: 3, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "MEDITERRANEO" };
  s.competitions.push(competition);
  setCompetitionTemplate("cv-1", template);
  s.referees.push(juez("cv-med", "MEDITERRANEO"), juez("cv-cen", "CENTRO"), juez("cv-ina", "MEDITERRANEO", { estado: "Inactivo" }));
});

const lanzar = (input: Partial<{ sesiones: string[]; cierraEl: string }> = {}) =>
  conv.crearConvocatoria(actor, competition, template, { sesiones: ["S1", "S2"], cierraEl: cierre, ...input });

describe("lanzar una convocatoria", () => {
  it("nace abierta y llega a la zona del campeonato", async () => {
    const c = await lanzar();
    expect(c).toMatchObject({ estado: "abierta", sesiones: ["S1", "S2"], cierraEl: cierre });
    expect(c.zonas).toEqual([expect.objectContaining({ zona: "MEDITERRANEO", estado: "aceptada", origen: "propia" })]);
  });

  it("rechaza fechas imposibles y sesiones que no están en la plantilla", async () => {
    await expect(lanzar({ cierraEl: addDaysIso(todayIso(), -1) })).rejects.toThrow(/anterior a hoy/);
    await expect(lanzar({ cierraEl: addDaysIso(fecha, 1) })).rejects.toThrow(/anterior al campeonato/);
    await expect(lanzar({ sesiones: ["S9"] })).rejects.toThrow(/al menos una sesión/);
  });

  it("solo una viva por campeonato; cancelada, se puede volver a lanzar", async () => {
    const c = await lanzar();
    await expect(lanzar()).rejects.toThrow(/ya tiene una convocatoria/);
    await conv.actualizarConvocatoria(c, competition, template, { estado: "cancelada" });
    await expect(lanzar()).resolves.toMatchObject({ estado: "abierta" });
  });

  it("un campeonato sin zona no se puede convocar", async () => {
    await expect(conv.crearConvocatoria(actor, { ...competition, zona: undefined }, template, { sesiones: ["S1"], cierraEl: cierre })).rejects.toThrow(/no tiene zona/);
  });
});

describe("el juez se apunta", () => {
  it("solo la ve un juez de una zona convocada", async () => {
    const c = await lanzar();
    expect((await conv.convocatoriasParaJuez("cv-med")).map((x) => x.id)).toEqual([c.id]);
    expect(await conv.convocatoriasParaJuez("cv-cen")).toEqual([]);
    expect(await conv.convocatoriaParaJuez("cv-cen", c.id)).toBeNull();
    await expect(conv.apuntarse("cv-cen", c.id, "S1")).rejects.toThrow(/no está disponible para ti/);
  });

  it("apuntarse dos veces no duplica, y aparece en la tarima", async () => {
    const c = await lanzar();
    await conv.apuntarse("cv-med", c.id, "S1");
    const vista = await conv.apuntarse("cv-med", c.id, "S1");
    expect(vista.sesiones.find((s) => s.session === "S1")?.inscrito).toBe(true);
    const tarima = await conv.getConvocatoriaDeCampeonato("cv-1");
    expect(tarima?.inscripciones).toEqual([expect.objectContaining({ refereeId: "cv-med", sesion: "S1" })]);
  });

  it("una sesión que no es de la convocatoria no vale", async () => {
    const c = await lanzar({ sesiones: ["S1"] });
    await expect(conv.apuntarse("cv-med", c.id, "S2")).rejects.toThrow(/no está en la convocatoria/);
  });

  it("con sanción activa o ficha inactiva no puede", async () => {
    const c = await lanzar();
    await expect(conv.apuntarse("cv-ina", c.id, "S1")).rejects.toThrow(/inactiva/);
    getStore().sanctions.push({
      id: "s1", refereeId: "cv-med", refereeName: "x", zona: "MEDITERRANEO", motivo: "m",
      fechaInicio: addDaysIso(todayIso(), -1), fechaFin: addDaysIso(todayIso(), 30), status: "activa",
      impuestaPorNombre: "y", delegateNotify: { status: "pendiente" },
    } as unknown as RefereeSanction);
    await expect(conv.apuntarse("cv-med", c.id, "S1")).rejects.toThrow(/sanción activa/);
  });

  it("cerrada, ni apuntarse ni retirarse (retirarse es avisar al delegado)", async () => {
    const c = await lanzar();
    await conv.apuntarse("cv-med", c.id, "S1");
    await conv.actualizarConvocatoria(c, competition, template, { estado: "cerrada" });
    await expect(conv.apuntarse("cv-med", c.id, "S2")).rejects.toThrow(/cerrada/);
    await expect(conv.retirarse("cv-med", c.id, "S1")).rejects.toThrow(/avisa a tu delegado/);
    // Una cerrada ya no sale en la lista de abiertas.
    expect(await conv.convocatoriasParaJuez("cv-med")).toEqual([]);
  });

  it("abierta, retirarse borra la inscripción", async () => {
    const c = await lanzar();
    await conv.apuntarse("cv-med", c.id, "S1");
    await conv.retirarse("cv-med", c.id, "S1");
    expect((await conv.getConvocatoriaDeCampeonato("cv-1"))?.inscripciones).toEqual([]);
  });
});

// ── Rutas ──
const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/auth")>()),
  requireApiUser: () => requireApiUser(),
}));

describe("POST /competitions/:id/convocatoria", () => {
  it("un delegado de otra zona no puede lanzarla", async () => {
    const { POST } = await import("@/app/api/v1/competitions/[id]/convocatoria/route");
    requireApiUser.mockResolvedValue({ id: "d", nombre: "D", email: "d@b", rol: "", iniciales: "D", role: "delegado_zona", zona: "CENTRO" });
    const res = await POST(new Request("http://x/", { method: "POST", body: JSON.stringify({ sesiones: ["S1"], cierraEl: cierre }) }), { params: Promise.resolve({ id: "cv-1" }) });
    expect(res.status).toBe(403);
  });

  it("el delegado de la zona sí", async () => {
    const { POST } = await import("@/app/api/v1/competitions/[id]/convocatoria/route");
    requireApiUser.mockResolvedValue({ id: "d", nombre: "D", email: "d@b", rol: "", iniciales: "D", role: "delegado_zona", zona: "MEDITERRANEO" });
    const res = await POST(new Request("http://x/", { method: "POST", body: JSON.stringify({ sesiones: ["S1"], cierraEl: cierre }) }), { params: Promise.resolve({ id: "cv-1" }) });
    expect(res.status).toBe(201);
  });
});
