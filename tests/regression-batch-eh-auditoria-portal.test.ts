import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { allowAction, resetActionLimits } from "@/lib/api/action-rate-limit";
import { addDaysIso, todayIso } from "@/lib/business-date";
import type { Competition, Referee, RosterSession } from "@/lib/types";

// Auditoría del portal del juez (seguridad y corrección), en memoria.

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Con el modo captura, la «gestión nacional» es la cuenta de captura: así los
// avisos a la gestión tienen destinatario y se pueden contar.
process.env.AEP_DOCS_CAPTURE = "1";

const { getStore, setCompetitionTemplate } = await import("@/server/store");
const conv = await import("@/server/convocatorias");
const { dataService } = await import("@/server/services");

const S1: RosterSession = { sesion: "S1", nombre: "Sesión 1", dia: "", categorias: [], horarioCompeticion: "", horarioPesaje: "", roles: [{ rol: "Central", key: "central", slots: 1 }], pesajeRoles: [] };
const S2: RosterSession = { ...S1, sesion: "S2", nombre: "Sesión 2" };
const delegadaMed = { id: "dm", nombre: "Delegada Med", role: "delegado_zona" as const, zona: "MEDITERRANEO" };
const delegadoCen = { id: "dc", nombre: "Delegado Centro", role: "delegado_zona" as const, zona: "CENTRO" };
const juez = (id: string, zona: string, userId?: string): Referee => ({ id, nombre: id, zona, nivel: "Nacional", estado: "Activo", eventos: 0, ultimo: "", disp: true, iniciales: "J", userId });
const fecha = addDaysIso(todayIso(), 30);
const comp = (id: string, patch: Partial<Competition> = {}): Competition => ({ id, nombre: id, tipo: "AEP-3", fecha, fechaFin: fecha, sede: "X", sesiones: 2, requeridos: 2, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "MEDITERRANEO", ...patch });

let c1: Competition;
beforeEach(() => {
  const s = getStore();
  s.convocatorias = [];
  s.inscripciones = [];
  s.notificaciones = [];
  s.respuestas = new Map();
  s.competitions = s.competitions.filter((c) => !c.id.startsWith("au-"));
  s.referees = s.referees.filter((r) => !r.id.startsWith("au-"));
  c1 = comp("au-1");
  s.competitions.push(c1);
  setCompetitionTemplate(c1.id, [S1, S2]);
  s.assignments.set(c1.id, {});
  s.referees.push(juez("au-med", "MEDITERRANEO", "u-au-med"));
  resetActionLimits();
});

const lanzar = (extra = {}) =>
  conv.crearConvocatoria(delegadaMed, c1, [S1, S2], { sesiones: ["S1", "S2"], cierraEl: addDaysIso(todayIso(), 10), ...extra });

describe("avisos con clave en Supabase", () => {
  it("el índice único de notificaciones es completo (PostgREST no puede inferir uno parcial)", () => {
    const sql = readFileSync("supabase/migrations/043_designaciones_y_avisos.sql", "utf8").replace(/--.*$/gm, "");
    const indice = sql.match(/CREATE UNIQUE INDEX[^;]*notificaciones_clave_unica[^;]*;/)?.[0] ?? "";
    expect(indice).toMatch(/\(user_id,\s*clave\)/);
    expect(indice).not.toMatch(/WHERE/i);
  });

  it("las tablas que escribe un juez solo avisan al tiempo real si cambian filas", () => {
    const sql = readFileSync("supabase/migrations/044_sync_solo_con_cambios.sql", "utf8");
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS notificaciones_sync_bump/);
    expect(sql).toMatch(/FOR EACH ROW/);
  });
});

describe("convocatorias tras cambios en la plantilla o el plazo", () => {
  it("reabrir no se bloquea por una sesión que ya no está en la plantilla", async () => {
    const c = await lanzar();
    await conv.actualizarConvocatoria(c, c1, [S1, S2], { estado: "cerrada" });
    const cerrada = (await dataService.getConvocatoria(c.id))!;
    const reabierta = await conv.actualizarConvocatoria(cerrada, c1, [S1], { estado: "abierta", cierraEl: addDaysIso(todayIso(), 12) });
    expect(reabierta).toMatchObject({ estado: "abierta", sesiones: ["S1"] });
  });

  it("no se aceptan ni se suman zonas a una convocatoria cerrada", async () => {
    const c = await lanzar({ zonasExtra: ["CENTRO"] });
    await conv.actualizarConvocatoria(c, c1, [S1, S2], { estado: "cerrada" });
    const cerrada = (await dataService.getConvocatoria(c.id))!;
    await expect(conv.resolverZona(delegadoCen, c.id, "CENTRO", true)).rejects.toThrow(/cerrada/);
    await expect(conv.abrirAOtrasZonas(delegadaMed, cerrada, c1, ["ANDALUCIA"])).rejects.toThrow(/cerrada/);
    // Rechazar sí: deja la petición resuelta.
    await expect(conv.resolverZona(delegadoCen, c.id, "CENTRO", false)).resolves.toBeUndefined();
  });
});

describe("lo que ve el juez", () => {
  it("el aviso de choque de fechas solo cuenta tarimas aprobadas (un borrador no se enseña)", async () => {
    const otra = comp("au-2", { nombre: "Otro campeonato" });
    getStore().competitions.push(otra);
    setCompetitionTemplate(otra.id, [S1]);
    getStore().assignments.set(otra.id, { S1_central_0: "au-med" });
    const c = await lanzar();
    expect((await conv.convocatoriaParaJuez("au-med", c.id))!.aviso).toBeUndefined();
    otra.aprobacion = "Aprobado";
    expect((await conv.convocatoriaParaJuez("au-med", c.id))!.aviso).toMatch(/Otro campeonato/);
  });
});

describe("designación", () => {
  beforeEach(() => {
    c1.aprobacion = "Aprobado";
    getStore().assignments.set(c1.id, { S1_central_0: "au-med" });
  });

  it("repetir «no puedo» no vuelve a llenar la campana de la gestión", async () => {
    const antes = getStore().notificaciones.length;
    await conv.responderDesignacion("au-med", c1.id, "rechazada", "Examen");
    const tras1 = getStore().notificaciones.length;
    expect(tras1).toBe(antes + 1);
    await conv.responderDesignacion("au-med", c1.id, "rechazada", "Examen otra vez");
    expect(getStore().notificaciones.length).toBe(tras1);
    // Cambiar de idea y volver a «no puedo» sí avisa otra vez.
    await conv.responderDesignacion("au-med", c1.id, "confirmada");
    await conv.responderDesignacion("au-med", c1.id, "rechazada", "Al final no");
    expect(getStore().notificaciones.length).toBe(tras1 + 1);
  });

  it("al aprobarse otra vez la tarima, las respuestas anteriores se borran", async () => {
    await conv.responderDesignacion("au-med", c1.id, "rechazada", "Examen");
    await conv.notificarDesignacion(c1.id, "apr-2");
    expect(await dataService.getDesignacionRespuestas(c1.id)).toEqual({});
  });
});

describe("límite de frecuencia", () => {
  it("corta a partir del máximo y se reinicia con la ventana", () => {
    for (let i = 0; i < 3; i++) expect(allowAction("k", 3, 1000, 0)).toBe(true);
    expect(allowAction("k", 3, 1000, 10)).toBe(false);
    expect(allowAction("k", 3, 1000, 1001)).toBe(true);
  });
});
