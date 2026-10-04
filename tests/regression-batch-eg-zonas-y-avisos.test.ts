import { beforeEach, describe, expect, it } from "vitest";
import { addDaysIso, todayIso } from "@/lib/business-date";
import type { Competition, Referee, RosterSession } from "@/lib/types";

// Portal del juez 3/3 (memoria): otras zonas con aceptación de su delegado,
// ampliación automática, recordatorio de cierre, designación con respuesta
// del juez y la campana de avisos.

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const { getStore, setCompetitionTemplate } = await import("@/server/store");
const conv = await import("@/server/convocatorias");
const { dataService } = await import("@/server/services");
const { assignReferee } = await import("@/server/services/memory-competitions");

const template: RosterSession[] = [
  { sesion: "S1", nombre: "Sesión 1", dia: "Sábado", categorias: [], horarioCompeticion: "10:00", horarioPesaje: "08:00", roles: [{ rol: "Central", key: "central", slots: 1 }, { rol: "Lateral", key: "lateral", slots: 2 }], pesajeRoles: [] },
];
const nacional = { id: "n", nombre: "Nacional", role: "super_admin" as const };
const delegadaMed = { id: "dm", nombre: "Delegada Med", role: "delegado_zona" as const, zona: "MEDITERRANEO" };
const delegadoCen = { id: "dc", nombre: "Delegado Centro", role: "delegado_zona" as const, zona: "CENTRO" };

function juez(id: string, zona: string, userId?: string): Referee {
  return { id, nombre: id, zona, nivel: "Nacional", estado: "Activo", eventos: 0, ultimo: "", disp: true, iniciales: "J", userId };
}

let competition: Competition;
function campeonato(fecha = addDaysIso(todayIso(), 30)): Competition {
  return { id: "zg-1", nombre: "Open Valencia", tipo: "AEP-3", fecha, fechaFin: fecha, sede: "Valencia", sesiones: 1, requeridos: 3, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "MEDITERRANEO" };
}

beforeEach(() => {
  const s = getStore();
  s.convocatorias = [];
  s.inscripciones = [];
  s.notificaciones = [];
  s.respuestas = new Map();
  s.competitions = s.competitions.filter((c) => !c.id.startsWith("zg-"));
  s.referees = s.referees.filter((r) => !r.id.startsWith("zg-"));
  competition = campeonato();
  s.competitions.push(competition);
  setCompetitionTemplate(competition.id, template);
  s.assignments.set(competition.id, {});
  s.referees.push(juez("zg-med", "MEDITERRANEO", "u-med"), juez("zg-cen", "CENTRO", "u-cen"), juez("zg-and", "ANDALUCIA", "u-and"));
});

const lanzar = (actor: Parameters<typeof conv.crearConvocatoria>[0], extra: Partial<Parameters<typeof conv.crearConvocatoria>[3]> = {}) =>
  conv.crearConvocatoria(actor, competition, template, { sesiones: ["S1"], cierraEl: addDaysIso(todayIso(), 10), ...extra });

describe("otras zonas", () => {
  it("si la abre la gestión nacional, la otra zona entra aceptada y sus jueces la ven", async () => {
    const c = await lanzar(nacional, { zonasExtra: ["CENTRO"] });
    expect(c.zonas.find((z) => z.zona === "CENTRO")).toMatchObject({ estado: "aceptada", origen: "delegado" });
    expect((await conv.convocatoriasParaJuez("zg-cen")).map((x) => x.id)).toEqual([c.id]);
    const [vista] = await conv.convocatoriasParaJuez("zg-cen");
    expect(vista!.otraZona).toBe(true);
  });

  it("si la abre un delegado de zona, espera a que el de la otra zona acepte", async () => {
    const c = await lanzar(delegadaMed, { zonasExtra: ["CENTRO"] });
    expect(c.zonas.find((z) => z.zona === "CENTRO")?.estado).toBe("pendiente");
    expect(await conv.convocatoriasParaJuez("zg-cen")).toEqual([]);
    // Solo el delegado de esa zona (o la gestión nacional) responde.
    await expect(conv.resolverZona(delegadaMed, c.id, "CENTRO", true)).rejects.toThrow(/Solo el delegado de esa zona/);
    expect((await conv.solicitudesParaUsuario(delegadoCen)).map((s) => s.zona)).toEqual(["CENTRO"]);
    await conv.resolverZona(delegadoCen, c.id, "CENTRO", true);
    expect((await conv.convocatoriasParaJuez("zg-cen")).map((x) => x.id)).toEqual([c.id]);
    await expect(conv.resolverZona(delegadoCen, c.id, "CENTRO", false)).rejects.toThrow(/ya estaba respondida/);
  });

  it("al aceptar, los jueces de esa zona reciben el aviso (una vez)", async () => {
    const c = await lanzar(delegadaMed, { zonasExtra: ["CENTRO"] });
    await conv.resolverZona(delegadoCen, c.id, "CENTRO", true);
    const bandeja = await dataService.getBandejaNotificaciones("u-cen");
    expect(bandeja.items.filter((n) => n.tipo === "convocatoria-nueva")).toHaveLength(1);
    // Y quien la lanzó se entera de la respuesta.
    expect((await dataService.getBandejaNotificaciones("dm")).items[0]).toMatchObject({ tipo: "zona-resuelta" });
  });

  it("al lanzarla, los jueces con cuenta de la zona propia reciben el aviso", async () => {
    await lanzar(delegadaMed);
    expect((await dataService.getBandejaNotificaciones("u-med")).sinLeer).toBe(1);
    expect((await dataService.getBandejaNotificaciones("u-cen")).sinLeer).toBe(0);
  });
});

describe("ampliación automática", () => {
  it("a X días del cierre y con huecos sin inscritos, pide ayuda a las demás zonas (pendientes)", async () => {
    const c = await lanzar(delegadaMed, { cierraEl: addDaysIso(todayIso(), 2), ampliarDiasAntes: 3 });
    await conv.revisarConvocatorias(Date.now() + 1e9);
    const after = (await dataService.getConvocatoria(c.id))!;
    expect(after.ampliadaAt).toBeTruthy();
    const auto = after.zonas.filter((z) => z.origen === "automatica");
    expect(auto.map((z) => z.zona).sort()).toEqual(["ANDALUCIA", "CANARIAS", "CENTRO", "NOROESTE"]);
    expect(auto.every((z) => z.estado === "pendiente")).toBe(true);
    // Otra revisión no vuelve a ampliar.
    await conv.revisarConvocatorias(Date.now() + 2e9);
    expect((await dataService.getConvocatoria(c.id))!.zonas).toHaveLength(after.zonas.length);
  });

  it("todavía lejos del cierre, no amplía", async () => {
    const c = await lanzar(delegadaMed, { cierraEl: addDaysIso(todayIso(), 20), ampliarDiasAntes: 3 });
    await conv.revisarConvocatorias(Date.now() + 3e9);
    expect((await dataService.getConvocatoria(c.id))!.ampliadaAt).toBeUndefined();
  });
});

describe("recordatorio de cierre", () => {
  it("el día antes, avisa a quien aún no se ha apuntado", async () => {
    getStore().referees.push(juez("zg-med2", "MEDITERRANEO", "u-med2"));
    const c = await lanzar(delegadaMed, { cierraEl: addDaysIso(todayIso(), 1) });
    await conv.apuntarse("zg-med", c.id, "S1");
    await conv.revisarConvocatorias(Date.now() + 4e9);
    const tipos = async (u: string) => (await dataService.getBandejaNotificaciones(u)).items.map((n) => n.tipo);
    expect(await tipos("u-med2")).toContain("convocatoria-cierra");
    expect(await tipos("u-med")).not.toContain("convocatoria-cierra");
  });
});

describe("designación", () => {
  it("el juez responde solo en una tarima aprobada en la que esté", async () => {
    await expect(conv.responderDesignacion("zg-med", competition.id, "confirmada")).rejects.toThrow(/No tienes una designación/);
    getStore().assignments.set(competition.id, { S1_central_0: "zg-med" });
    await expect(conv.responderDesignacion("zg-med", competition.id, "confirmada")).rejects.toThrow(/No tienes una designación/);
    competition.aprobacion = "Aprobado";
    await conv.responderDesignacion("zg-med", competition.id, "confirmada");
    expect((await dataService.getDesignacionRespuestas(competition.id))["zg-med"]).toMatchObject({ estado: "confirmada" });
    await expect(conv.responderDesignacion("zg-med", competition.id, "rechazada")).rejects.toThrow(/por qué no puedes/);
    await conv.responderDesignacion("zg-med", competition.id, "rechazada", "Examen ese día");
    expect((await dataService.getRespuestasDeJuez("zg-med"))[competition.id]).toMatchObject({ estado: "rechazada", motivo: "Examen ese día" });
  });

  it("al aprobar la tarima, cada designado con cuenta recibe un aviso (una vez por aprobación)", async () => {
    getStore().assignments.set(competition.id, { S1_central_0: "zg-med", S1_lateral_0: "zg-cen" });
    await conv.notificarDesignacion(competition.id, "apr-1");
    await conv.notificarDesignacion(competition.id, "apr-1");
    for (const u of ["u-med", "u-cen"]) {
      expect((await dataService.getBandejaNotificaciones(u)).items.filter((n) => n.tipo === "designacion")).toHaveLength(1);
    }
  });
});

describe("campana", () => {
  it("cuenta las no leídas y las marca como leídas", async () => {
    await dataService.insertNotificaciones([
      { userId: "x", tipo: "designacion", titulo: "a" },
      { userId: "x", tipo: "designacion", titulo: "b", clave: "k" },
      { userId: "x", tipo: "designacion", titulo: "b otra vez", clave: "k" },
    ]);
    expect((await dataService.getBandejaNotificaciones("x")).sinLeer).toBe(2);
    await dataService.marcarNotificacionesLeidas("x");
    expect((await dataService.getBandejaNotificaciones("x")).sinLeer).toBe(0);
  });
});

describe("tarima en memoria: asignar con motivo de fuera de zona", () => {
  // El twin en memoria no tenía el parámetro `crossZoneReason` y el motivo
  // llegaba como `expectedRefereeId`: toda asignación de otra zona salía como
  // conflicto («otro usuario liberó ese hueco»).
  it("no da un conflicto falso", async () => {
    const res = await assignReferee(competition.id, "S1_central_0", "zg-cen", "Delegada", undefined, "Convocatoria abierta a Centro", null);
    expect(res.conflict).toBeUndefined();
    expect(res.assignments?.S1_central_0).toBe("zg-cen");
  });
});
