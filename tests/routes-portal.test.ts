import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { SessionUser } from "@/lib/types";
import { ctx, get, juez, peticion, sinSesion, usuarios } from "./helpers/route-harness";

// Portal del juez, campana de avisos, respuesta de zona a una convocatoria y
// acceso al portal desde la ficha. Lo que más importa: el portal actúa SIEMPRE
// sobre la ficha de la sesión, nunca sobre una que venga en la petición.

const { auth, ds, conv, cuentas, proxy, exportaciones } = vi.hoisted(() => {
  type Store = Record<string, Mock<(...a: unknown[]) => Promise<unknown>>>;
  return {
    auth: { api: null as unknown, judge: null as unknown, any: null as unknown },
    ds: {} as Store,
    conv: {} as Store,
    cuentas: {} as Store,
    /** Módulo simulado con estas exportaciones, cada una un `vi.fn` de `store`. */
    exportaciones: (store: Store, nombres: string[]) =>
      Object.fromEntries(
        nombres.map((n) => [n, (...a: unknown[]) => (store[n] ??= vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => undefined))(...a)]),
      ),
    proxy: (store: Store) =>
      new Proxy(
        {},
        {
          // `then`: si no, Vitest toma el módulo por una promesa y lo espera.
          get: (_t, k) =>
            typeof k === "string" && !["then", "__esModule", "default"].includes(k)
              ? (store[k] ??= vi.fn(async () => undefined))
              : undefined,
        },
      ),
  };
});

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: async () => auth.api,
  requireJudgeUser: async () => auth.judge,
  requireAnyUser: async () => auth.any,
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({ dataService: proxy(ds) }));
vi.mock("@/server/convocatorias", () =>
  exportaciones(conv, [
    "convocatoriasParaJuez",
    "convocatoriaParaJuez",
    "apuntarse",
    "retirarse",
    "responderDesignacion",
    "resolverZona",
  ]),
);
vi.mock("@/server/services/judge-accounts", () => exportaciones(cuentas, ["issueAccessCodes", "revokeJudgeAccess"]));

const fn = (store: Record<string, Mock<(...a: unknown[]) => Promise<unknown>>>, name: string) =>
  (store[name] ??= vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => undefined));

import { GET as listar } from "@/app/api/v1/portal/convocatorias/route";
import { GET as detalle } from "@/app/api/v1/portal/convocatorias/[id]/route";
import {
  POST as apuntarse,
  DELETE as retirarse,
} from "@/app/api/v1/portal/convocatorias/[id]/inscripciones/route";
import { POST as responder } from "@/app/api/v1/portal/designaciones/[competitionId]/route";
import { GET as avisos, PATCH as leerAvisos } from "@/app/api/v1/notificaciones/route";
import { POST as zonaConvocatoria } from "@/app/api/v1/convocatorias/[id]/zonas/[zona]/route";
import {
  POST as darAcceso,
  DELETE as quitarAcceso,
} from "@/app/api/v1/referees/[id]/portal-access/route";
import { resetActionLimits } from "@/lib/api/action-rate-limit";

const comoJuez = (u: SessionUser | Response = juez) => {
  auth.judge = u;
};

beforeEach(() => {
  for (const s of [ds, conv, cuentas]) for (const k of Object.keys(s)) delete s[k];
  resetActionLimits();
  comoJuez();
  auth.api = usuarios.admin;
  auth.any = usuarios.admin;
});

describe("portal: solo para jueces", () => {
  it("sin sesión de juez, 401 y no se toca nada", async () => {
    comoJuez(sinSesion());
    expect((await listar()).status).toBe(401);
    expect((await detalle(get(), ctx({ id: "v1" }))).status).toBe(401);
    expect((await apuntarse(peticion({ sesion: "S1" }), ctx({ id: "v1" }))).status).toBe(401);
    expect((await responder(peticion({ estado: "confirmada" }), ctx({ competitionId: "c1" }))).status).toBe(401);
    expect(Object.keys(conv)).toEqual([]);
  });
});

describe("portal: siempre sobre la ficha de la sesión", () => {
  it("listar y ver usan la ficha de la sesión", async () => {
    fn(conv, "convocatoriasParaJuez").mockResolvedValue([]);
    await listar();
    expect(fn(conv, "convocatoriasParaJuez")).toHaveBeenCalledWith("j1");

    fn(conv, "convocatoriaParaJuez").mockResolvedValue({ id: "v1" });
    expect((await detalle(get(), ctx({ id: "v1" }))).status).toBe(200);
    expect(fn(conv, "convocatoriaParaJuez")).toHaveBeenCalledWith("j1", "v1");
  });

  it("una convocatoria que no es para él es 404", async () => {
    fn(conv, "convocatoriaParaJuez").mockResolvedValue(null);
    expect((await detalle(get(), ctx({ id: "ajena" }))).status).toBe(404);
  });

  it("apuntarse ignora cualquier ficha que venga en el cuerpo", async () => {
    fn(conv, "apuntarse").mockResolvedValue({ ok: true });
    const res = await apuntarse(peticion({ sesion: "S1", refereeId: "otro-juez", nota: "Llego tarde" }), ctx({ id: "v1" }));
    expect(res.status).toBe(200);
    expect(fn(conv, "apuntarse")).toHaveBeenCalledWith("j1", "v1", "S1", "Llego tarde");
  });

  it("retirarse pide la sesión y usa la ficha de la sesión", async () => {
    expect((await retirarse(peticion(undefined, "DELETE"), ctx({ id: "v1" }))).status).toBe(400);
    fn(conv, "retirarse").mockResolvedValue({ ok: true });
    const res = await retirarse(
      peticion(undefined, "DELETE", "http://localhost/api?sesion=S2&refereeId=otro"),
      ctx({ id: "v1" }),
    );
    expect(res.status).toBe(200);
    expect(fn(conv, "retirarse")).toHaveBeenCalledWith("j1", "v1", "S2");
  });

  it("responder a una designación: valores cerrados y motivo acotado", async () => {
    expect((await responder(peticion({ estado: "quizá" }), ctx({ competitionId: "c1" }))).status).toBe(400);
    expect(
      (await responder(peticion({ estado: "rechazada", motivo: "x".repeat(501) }), ctx({ competitionId: "c1" }))).status,
    ).toBe(400);
    const res = await responder(peticion({ estado: "rechazada", motivo: "Viaje" }), ctx({ competitionId: "c1" }));
    expect(res.status).toBe(200);
    expect(fn(conv, "responderDesignacion")).toHaveBeenCalledWith("j1", "c1", "rechazada", "Viaje");
  });

  it("apuntarse sin sesión o con una nota desmesurada es 400", async () => {
    expect((await apuntarse(peticion({}), ctx({ id: "v1" }))).status).toBe(400);
    expect((await apuntarse(peticion({ sesion: "S1", nota: "x".repeat(501) }), ctx({ id: "v1" }))).status).toBe(400);
    expect(fn(conv, "apuntarse")).not.toHaveBeenCalled();
  });

  it("frena a quien repite la misma acción en bucle", async () => {
    fn(conv, "apuntarse").mockResolvedValue({ ok: true });
    let ultimo = 200;
    for (let i = 0; i < 61; i++) ultimo = (await apuntarse(peticion({ sesion: "S1" }), ctx({ id: "v1" }))).status;
    expect(ultimo).toBe(429);
  });
});

describe("campana de avisos", () => {
  it("cada uno ve y marca solo los suyos", async () => {
    auth.any = juez;
    fn(ds, "getBandejaNotificaciones").mockResolvedValue({ items: [] });
    expect((await avisos()).status).toBe(200);
    expect(fn(ds, "getBandejaNotificaciones")).toHaveBeenCalledWith("u-juez");

    expect((await leerAvisos(peticion({ ids: ["n1"] }, "PATCH"))).status).toBe(200);
    expect(fn(ds, "marcarNotificacionesLeidas")).toHaveBeenCalledWith("u-juez", ["n1"]);
  });

  it("sin sesión, 401; lista de ids no válida, 400", async () => {
    auth.any = sinSesion();
    expect((await avisos()).status).toBe(401);
    auth.any = usuarios.lectura;
    expect((await leerAvisos(peticion({ ids: "n1" }, "PATCH"))).status).toBe(400);
    expect((await leerAvisos(peticion({ ids: Array(101).fill("n") }, "PATCH"))).status).toBe(400);
  });
});

describe("respuesta de una zona a una convocatoria", () => {
  it("solo lectura y financiero no pueden", async () => {
    for (const u of [usuarios.lectura, usuarios.financiero]) {
      auth.api = u;
      expect((await zonaConvocatoria(peticion({ aceptar: true }), ctx({ id: "v1", zona: "CENTRO" }))).status).toBe(403);
    }
    expect(fn(conv, "resolverZona")).not.toHaveBeenCalled();
  });

  it("valida la respuesta y decodifica la zona", async () => {
    auth.api = usuarios.zona;
    expect((await zonaConvocatoria(peticion({ aceptar: "sí" }), ctx({ id: "v1", zona: "CENTRO" }))).status).toBe(400);
    const res = await zonaConvocatoria(peticion({ aceptar: false }), ctx({ id: "v1", zona: "1-%20NOROESTE" }));
    expect(res.status).toBe(200);
    expect(fn(conv, "resolverZona")).toHaveBeenCalledWith(usuarios.zona, "v1", "1- NOROESTE", false);
  });
});

describe("acceso al portal desde la ficha", () => {
  it("solo gestión de jueces, y el delegado solo en su zona", async () => {
    auth.api = usuarios.lectura;
    expect((await darAcceso(peticion(), ctx({ id: "j1" }))).status).toBe(403);
    auth.api = usuarios.otraZona;
    fn(ds, "getReferee").mockResolvedValue({ id: "j1", zona: "CENTRO" });
    expect((await darAcceso(peticion(), ctx({ id: "j1" }))).status).toBe(403);
    expect(fn(cuentas, "issueAccessCodes")).not.toHaveBeenCalled();
  });

  it("genera el código en nombre de quien lo pide", async () => {
    auth.api = usuarios.zona;
    fn(ds, "getReferee").mockResolvedValue({ id: "j1", zona: "CENTRO" });
    fn(cuentas, "issueAccessCodes").mockResolvedValue([{ refereeId: "j1", outcome: "codigo", code: "ABCDEFGH" }]);
    const res = await darAcceso(peticion(), ctx({ id: "j1" }));
    expect(res.status).toBe(200);
    expect(fn(cuentas, "issueAccessCodes")).toHaveBeenCalledWith([{ id: "j1", zona: "CENTRO" }], "u-zona");
  });

  it("ficha inexistente, 404; retirar a quien no tiene acceso, 404", async () => {
    fn(ds, "getReferee").mockResolvedValueOnce(undefined);
    expect((await darAcceso(peticion(), ctx({ id: "nadie" }))).status).toBe(404);
    fn(ds, "getReferee").mockResolvedValue({ id: "j1", zona: "CENTRO" });
    fn(cuentas, "revokeJudgeAccess").mockResolvedValue(false);
    expect((await quitarAcceso(peticion(undefined, "DELETE"), ctx({ id: "j1" }))).status).toBe(404);
    fn(cuentas, "revokeJudgeAccess").mockResolvedValue(true);
    expect((await quitarAcceso(peticion(undefined, "DELETE"), ctx({ id: "j1" }))).status).toBe(200);
  });
});
