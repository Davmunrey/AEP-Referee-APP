import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/types";
import { campeonato, ctx, cuerpo, get, peticion, sinSesion, usuarios } from "./helpers/route-harness";

// Rutas de la tarima: quién puede leer y escribir (rol y zona), qué pasa con
// una tarima aprobada, la validación del cuerpo y que el camino bueno llega al
// servicio con los argumentos correctos.

const { auth, ds } = vi.hoisted(() => {
  const ds: Record<string, ReturnType<typeof vi.fn>> = {};
  return { auth: { user: null as unknown }, ds };
});

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: async () => auth.user,
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: new Proxy(
    {},
    { get: (_t, k: string) => (ds[k] ??= vi.fn(async () => undefined)) },
  ),
}));

const fn = (name: string) => (ds[name] ??= vi.fn(async () => undefined));
const como = (u: SessionUser | Response) => {
  auth.user = u;
};

import { GET as getRoster } from "@/app/api/v1/competitions/[id]/roster/route";
import { POST as submit } from "@/app/api/v1/competitions/[id]/roster/submit/route";
import { POST as clearSlot, DELETE as clearAll } from "@/app/api/v1/competitions/[id]/roster/clear/route";
import { POST as draft } from "@/app/api/v1/competitions/[id]/roster/draft/route";
import { PATCH as flags } from "@/app/api/v1/competitions/[id]/roster/flags/route";
import {
  POST as templatePreset,
  PUT as templatePut,
  DELETE as templateDelete,
} from "@/app/api/v1/competitions/[id]/roster/template/route";
import { GET as history } from "@/app/api/v1/competitions/[id]/roster/history/route";
import { GET as exportRoster } from "@/app/api/v1/competitions/[id]/roster/export/route";
import { POST as imprevisto } from "@/app/api/v1/competitions/[id]/roster/imprevisto/route";
import { POST as assign } from "@/app/api/v1/competitions/[id]/roster/assign/route";
import { RosterPaidClaimError, RosterSlotConflictError } from "@/lib/competitions/service-types";

const c1 = ctx({ id: "c1" });

const sesion = (slots = 2) => ({
  sesion: "S1",
  nombre: "Sesión 1",
  dia: "Sábado",
  categorias: [],
  horarioCompeticion: "10:00",
  horarioPesaje: "08:00",
  roles: [{ rol: "Central", key: "central", slots }],
  pesajeRoles: [],
});

beforeEach(() => {
  for (const k of Object.keys(ds)) delete ds[k];
  como(usuarios.admin);
  fn("getCompetition").mockResolvedValue(campeonato());
});

describe("lectura de la tarima", () => {
  it("sin sesión, 401 y no se lee nada", async () => {
    como(sinSesion());
    expect((await getRoster(get(), c1)).status).toBe(401);
    expect(fn("getRoster")).not.toHaveBeenCalled();
  });

  it("un delegado de otra zona no la ve", async () => {
    como(usuarios.otraZona);
    expect((await getRoster(get(), c1)).status).toBe(403);
    expect(fn("getRoster")).not.toHaveBeenCalled();
  });

  it("su delegado de zona y la gestión nacional sí", async () => {
    fn("getRoster").mockResolvedValue({ template: [], assignments: {} });
    for (const u of [usuarios.zona, usuarios.admin, usuarios.lectura]) {
      como(u);
      expect((await getRoster(get(), c1)).status).toBe(200);
    }
  });

  it("historial y exportación respetan la misma zona", async () => {
    como(usuarios.otraZona);
    expect((await history(get(), c1)).status).toBe(403);
    expect((await exportRoster(get(), c1)).status).toBe(403);
    como(usuarios.zona);
    fn("getRosterHistory").mockResolvedValue([]);
    expect((await history(get(), c1)).status).toBe(200);
    fn("exportRoster").mockResolvedValue("ACTA");
    const res = await exportRoster(get(), c1);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("roster-c1.txt");
    expect(await res.text()).toBe("ACTA");
  });

  it("exportar un campeonato inexistente es 404", async () => {
    fn("exportRoster").mockResolvedValue(null);
    expect((await exportRoster(get(), c1)).status).toBe(404);
  });
});

describe("permisos de escritura comunes", () => {
  const escrituras: [string, () => Promise<Response>][] = [
    ["borrador", () => draft(peticion(), c1)],
    ["vaciar", () => clearAll(peticion(undefined, "DELETE"), c1)],
    ["plantilla estándar", () => templatePreset(peticion(), c1)],
    ["borrar plantilla", () => templateDelete(peticion(undefined, "DELETE"), c1)],
    ["enviar", () => submit(peticion(), c1)],
  ];

  it.each(escrituras)("%s: solo lectura y financiero no pueden", async (_n, call) => {
    for (const u of [usuarios.lectura, usuarios.financiero]) {
      como(u);
      expect((await call()).status).toBe(403);
    }
  });

  it.each(escrituras)("%s: un delegado de otra zona no puede", async (_n, call) => {
    como(usuarios.otraZona);
    expect((await call()).status).toBe(403);
  });

  it.each(escrituras)("%s: con la tarima aprobada está bloqueada (423)", async (_n, call) => {
    fn("getCompetition").mockResolvedValue(campeonato({ aprobacion: "Aprobado" }));
    expect((await call()).status).toBe(423);
  });

  it.each(escrituras)("%s: campeonato inexistente es 404", async (_n, call) => {
    fn("getCompetition").mockResolvedValue(undefined);
    expect((await call()).status).toBe(404);
  });

  it("si la base no responde al cargar el campeonato, error con cuerpo JSON", async () => {
    fn("getCompetition").mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await draft(peticion(), c1);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect((await cuerpo(res)).error).toBeTruthy();
  });
});

describe("enviar a aprobación", () => {
  it("sin plantilla, 400", async () => {
    fn("getRoster").mockResolvedValue({ template: [], assignments: {} });
    expect((await submit(peticion(), c1)).status).toBe(400);
    expect(fn("submitRoster")).not.toHaveBeenCalled();
  });

  it("sin ningún juez, 400", async () => {
    fn("getRoster").mockResolvedValue({ template: [sesion()], assignments: {} });
    expect((await submit(peticion(), c1)).status).toBe(400);
  });

  it("con huecos pendientes, 400 y dice cuántos", async () => {
    fn("getRoster").mockResolvedValue({ template: [sesion(2)], assignments: { S1_central_0: "j1" } });
    const res = await submit(peticion(), c1);
    expect(res.status).toBe(400);
    expect((await cuerpo(res)).error).toContain("1 pendientes");
  });

  it("completa, se envía en nombre de quien llama", async () => {
    como(usuarios.zona);
    fn("getRoster").mockResolvedValue({
      template: [sesion(2)],
      assignments: { S1_central_0: "j1", S1_central_1: "j2" },
    });
    fn("submitRoster").mockResolvedValue({ id: "p1" });
    const res = await submit(peticion(), c1);
    expect(res.status).toBe(200);
    expect(fn("submitRoster")).toHaveBeenCalledWith("c1", usuarios.zona.nombre, usuarios.zona.id);
  });
});

describe("liberar un hueco", () => {
  it("cuerpo inválido o hueco desmesurado, 400", async () => {
    expect((await clearSlot(peticion("no-json"), c1)).status).toBe(400);
    expect((await clearSlot(peticion({ slotKey: "x".repeat(101) }), c1)).status).toBe(400);
    expect(fn("clearSlot")).not.toHaveBeenCalled();
  });

  it("libera el hueco con el control optimista", async () => {
    fn("clearSlot").mockResolvedValue({});
    const res = await clearSlot(peticion({ slotKey: "S1_central_0", expectedRefereeId: "j1" }), c1);
    expect(res.status).toBe(200);
    expect(fn("clearSlot")).toHaveBeenCalledWith("c1", "S1_central_0", usuarios.admin.nombre, "j1");
  });

  it("conflicto 409 y liquidación pagada 423", async () => {
    fn("clearSlot").mockRejectedValueOnce(new RosterSlotConflictError("otro llegó antes"));
    expect((await clearSlot(peticion({ slotKey: "S1_central_0" }), c1)).status).toBe(409);
    fn("clearSlot").mockRejectedValueOnce(new RosterPaidClaimError("pagada"));
    expect((await clearSlot(peticion({ slotKey: "S1_central_0" }), c1)).status).toBe(423);
  });

  it("vaciar toda la tarima llama al servicio", async () => {
    fn("clearRosterAssignments").mockResolvedValue({ assignments: {} });
    expect((await clearAll(peticion(undefined, "DELETE"), c1)).status).toBe(200);
    expect(fn("clearRosterAssignments")).toHaveBeenCalledWith("c1", usuarios.admin.nombre);
  });
});

describe("asignar un juez", () => {
  it("datos inválidos, 400", async () => {
    expect((await assign(peticion({ slotKey: "", refereeId: "j1" }), c1)).status).toBe(400);
    expect((await assign(peticion({ slotKey: "S1_central_0", refereeId: "" }), c1)).status).toBe(400);
    expect(fn("assignReferee")).not.toHaveBeenCalled();
  });

  it("el servicio dice conflicto, 409; error de negocio, 400", async () => {
    fn("assignReferee").mockResolvedValueOnce({ conflict: true, error: "Ocupado" });
    expect((await assign(peticion({ slotKey: "S1_central_0", refereeId: "j1" }), c1)).status).toBe(409);
    fn("assignReferee").mockResolvedValueOnce({ error: "Juez sancionado" });
    expect((await assign(peticion({ slotKey: "S1_central_0", refereeId: "j1" }), c1)).status).toBe(400);
  });

  it("asigna con el nombre de quien llama", async () => {
    fn("assignReferee").mockResolvedValue({ assignments: { S1_central_0: "j1" }, flags: {}, crossZoneMap: {} });
    const res = await assign(peticion({ slotKey: "S1_central_0", refereeId: "j1" }), c1);
    expect(res.status).toBe(200);
    expect(fn("assignReferee").mock.calls[0]?.slice(0, 4)).toEqual([
      "c1",
      "S1_central_0",
      "j1",
      usuarios.admin.nombre,
    ]);
  });
});

describe("marcas de un hueco", () => {
  it("sin hueco o con uno desmesurado, 400", async () => {
    expect((await flags(peticion({ flags: {} }, "PATCH"), c1)).status).toBe(400);
    expect((await flags(peticion({ slotKey: "x".repeat(101) }, "PATCH"), c1)).status).toBe(400);
  });

  it("solo guarda booleanos", async () => {
    fn("setSlotFlags").mockResolvedValue({ flags: {} });
    await flags(peticion({ slotKey: "S1_central_0", flags: { compartido: "sí", intercambio: 0 } }, "PATCH"), c1);
    expect(fn("setSlotFlags")).toHaveBeenCalledWith(
      "c1",
      "S1_central_0",
      { compartido: true, intercambio: false },
      usuarios.admin.nombre,
    );
  });
});

describe("plantilla", () => {
  it("una plantilla mal formada no se guarda", async () => {
    const res = await templatePut(peticion({ template: [{ sesion: "S1" }] }, "PUT"), c1);
    expect(res.status).toBe(400);
    expect(fn("saveCompetitionTemplate")).not.toHaveBeenCalled();
  });

  it("una huella de versión mal formada es 400", async () => {
    const res = await templatePut(peticion({ template: [sesion()], baseHash: "zz" }, "PUT"), c1);
    expect(res.status).toBe(400);
  });

  it("guarda la plantilla con su huella", async () => {
    fn("saveCompetitionTemplate").mockResolvedValue({ template: [sesion()] });
    const res = await templatePut(peticion({ template: [sesion()], baseHash: "0123abcd" }, "PUT"), c1);
    expect(res.status).toBe(200);
    expect(fn("saveCompetitionTemplate").mock.calls[0]?.[3]).toBe("0123abcd");
  });

  it("borrar la plantilla guarda una vacía; con dinero pagado, 423", async () => {
    fn("saveCompetitionTemplate").mockResolvedValueOnce({ template: [] });
    expect((await templateDelete(peticion(undefined, "DELETE"), c1)).status).toBe(200);
    expect(fn("saveCompetitionTemplate").mock.calls[0]?.[1]).toEqual([]);
    fn("saveCompetitionTemplate").mockRejectedValueOnce(new RosterPaidClaimError("pagada"));
    expect((await templateDelete(peticion(undefined, "DELETE"), c1)).status).toBe(423);
  });
});

describe("imprevisto en una tarima aprobada", () => {
  it("solo quien puede editar la zona", async () => {
    fn("getCompetition").mockResolvedValue(campeonato({ aprobacion: "Aprobado" }));
    for (const u of [usuarios.lectura, usuarios.otraZona, usuarios.financiero]) {
      como(u);
      expect((await imprevisto(peticion(), c1)).status).toBe(403);
    }
    expect(fn("unlockRosterImprevisto")).not.toHaveBeenCalled();
  });

  it("desbloquea en nombre de quien llama; si el servicio lo rechaza, 400", async () => {
    como(usuarios.zona);
    fn("getCompetition").mockResolvedValue(campeonato({ aprobacion: "Aprobado" }));
    fn("unlockRosterImprevisto").mockResolvedValueOnce({ aprobacion: "Cambio por imprevisto" });
    expect((await imprevisto(peticion(), c1)).status).toBe(200);
    expect(fn("unlockRosterImprevisto")).toHaveBeenCalledWith("c1", usuarios.zona.nombre);
    fn("unlockRosterImprevisto").mockResolvedValueOnce({ error: "No está aprobada" });
    expect((await imprevisto(peticion(), c1)).status).toBe(400);
  });
});
