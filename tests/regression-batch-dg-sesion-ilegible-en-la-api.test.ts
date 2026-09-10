import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProfileReadError } from "@/lib/auth/session-errors";

/**
 * La otra mitad de `regression-batch-df-perfil-ilegible-no-es-sin-acceso`: lo
 * que responde la API cuando no se ha podido leer el perfil.
 *
 * Con un 401 el cliente enseña «Tu sesión ha caducado. Vuelve a entrar» —lo
 * dice `mensajeDeEstado`— y manda a hacer login a quien acaba de hacerlo. 503
 * es lo que de verdad pasa: vuelve a intentarlo dentro de un momento.
 *
 * En su propio fichero porque `vi.mock` del módulo de sesión se iza al
 * principio y dejaría sin original al otro, que sí necesita el de verdad.
 */

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const { requireApiUser, isSessionUser } = await import("@/lib/api/auth");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lo que responde la API", () => {
  it("un fallo de lectura sale como 503, no como 401", async () => {
    getSession.mockRejectedValue(new SessionProfileReadError("timeout"));
    const res = await requireApiUser();
    expect(isSessionUser(res)).toBe(false);
    const respuesta = res as Response;
    expect(respuesta.status).toBe(503);
    const body = (await respuesta.json()) as { error: string };
    expect(body.error).toBe("No se pudo comprobar tu sesión. Vuelve a intentarlo.");
  });

  it("no filtra el detalle interno del fallo", async () => {
    getSession.mockRejectedValue(new SessionProfileReadError("relation «profiles» does not exist"));
    const res = (await requireApiUser()) as Response;
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toContain("profiles");
  });

  it("y no estar autenticado sigue siendo 401", async () => {
    getSession.mockResolvedValue(null);
    const res = (await requireApiUser()) as Response;
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("No autenticado");
  });

  it("con sesión, devuelve el usuario tal cual", async () => {
    getSession.mockResolvedValue({ id: "u1", email: "a@aep.test", nombre: "Ana" });
    const res = await requireApiUser();
    expect(isSessionUser(res)).toBe(true);
  });
});
