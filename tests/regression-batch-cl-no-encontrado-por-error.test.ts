import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lecturas y borrados que tiraban el `error` de `supabase-js` y salían por la
 * ruta como «no encontrado». En una pantalla de administración eso es lo peor
 * que se puede decir: quien acaba de pedir borrar o desactivar una cuenta lee
 * «Usuario no encontrado» y entiende «ya no está». La cuenta seguía entera,
 * con su acceso; el examen y el informe, igual.
 */

type Fallo = { message: string; code?: string } | null;
const fallos: Record<string, Fallo> = {};
const filas: Record<string, Record<string, unknown> | undefined> = {};

const requireApiUser = vi.fn();
const deleteUser = vi.fn(async () => ({ error: null }));
const updateUserById = vi.fn(async () => ({ error: null }));
const getExams = vi.fn();
const updateExam = vi.fn();
const deleteExam = vi.fn();
const getReport = vi.fn();
const deleteReport = vi.fn();

function q(tabla: string): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  const fila = () => ({
    data: fallos[tabla] ? null : (filas[tabla] ?? null),
    error: fallos[tabla] ?? null,
  });
  const lista = () => ({
    data: fallos[tabla] ? null : filas[tabla] ? [filas[tabla]] : [],
    error: fallos[tabla] ?? null,
  });
  Object.assign(self, {
    select: () => self,
    update: () => self,
    insert: () => self,
    delete: () => self,
    eq: () => self,
    in: () => self,
    order: () => self,
    maybeSingle: async () => fila(),
    single: async () => fila(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(lista()).then(resolve),
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabla: string) => q(tabla),
    auth: { admin: { deleteUser, updateUserById } },
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services/admin-audit", () => ({ recordAccessChange: vi.fn(async () => {}) }));
vi.mock("@/server/services", () => ({
  dataService: {
    getExams: (...a: unknown[]) => getExams(...a),
    updateExam: (...a: unknown[]) => updateExam(...a),
    deleteExam: (...a: unknown[]) => deleteExam(...a),
    getReport: (...a: unknown[]) => getReport(...a),
    deleteReport: (...a: unknown[]) => deleteReport(...a),
  },
}));

const { PATCH: editarUsuario, DELETE: borrarUsuario } = await import(
  "@/app/api/v1/admin/users/[id]/route"
);
const { POST: restablecer } = await import("@/app/api/v1/admin/users/[id]/password/route");
const { PATCH: editarExamen, DELETE: borrarExamen } = await import("@/app/api/v1/exams/[id]/route");
const { DELETE: borrarInforme } = await import("@/app/api/v1/reports/[id]/route");
const { examsService } = await import("@/server/services/supabase-exams");

const ADMIN = { id: "u-admin", role: "super_admin", nombre: "Admin", zona: null };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (method: string, body: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(fallos)) delete fallos[k];
  for (const k of Object.keys(filas)) delete filas[k];
  requireApiUser.mockResolvedValue(ADMIN);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("administración de cuentas: leer al usuario y no poder", () => {
  it("desactivar: un corte de lectura no es «Usuario no encontrado»", async () => {
    fallos.profiles = { message: "statement timeout" };
    const res = await editarUsuario(json("PATCH", { activo: false }), ctx("u-2"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "No se pudo cargar el usuario" });
  });

  it("borrar: con la lectura rota no se toca auth y no se dice que ya no está", async () => {
    fallos.profiles = { message: "connection reset" };
    const res = await borrarUsuario(new Request("http://localhost/x", { method: "DELETE" }), ctx("u-2"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "No se pudo cargar el usuario" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("restablecer la contraseña: ídem, y no se cambia ninguna contraseña", async () => {
    fallos.profiles = { message: "permission denied" };
    const res = await restablecer(json("POST", { password: "unaclave8" }), ctx("u-2"));
    expect(res.status).toBe(500);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("y quien de verdad no existe sigue siendo un 404", async () => {
    const res = await borrarUsuario(new Request("http://localhost/x", { method: "DELETE" }), ctx("u-9"));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: "Usuario no encontrado" });
  });
});

describe("el servicio de exámenes e informes", () => {
  it("un borrado que falla no es «no había nada que borrar»", async () => {
    fallos.referee_exams = { message: "deadlock detected" };
    await expect(examsService.deleteExam("ex-1")).rejects.toThrow(/referee_exams/);
    fallos.referee_reports = { message: "deadlock detected" };
    await expect(examsService.deleteReport("rep-1")).rejects.toThrow(/referee_reports/);
  });

  it("borrar lo que no está sigue siendo `false`, y lo que está, `true`", async () => {
    await expect(examsService.deleteExam("ex-404")).resolves.toBe(false);
    filas.referee_exams = { id: "ex-1" };
    await expect(examsService.deleteExam("ex-1")).resolves.toBe(true);
  });

  it("actualizar: sin fila es `undefined`; con error, se lanza", async () => {
    fallos.referee_exams = { message: "no rows", code: "PGRST116" };
    await expect(examsService.updateExam("ex-1", { notas: "x" })).resolves.toBeUndefined();
    fallos.referee_exams = { message: "statement timeout" };
    await expect(examsService.updateExam("ex-1", { notas: "x" })).rejects.toThrow(/referee_exams/);
    fallos.referee_reports = { message: "statement timeout" };
    await expect(examsService.updateReport("rep-1", { titulo: "x" })).rejects.toThrow(/referee_reports/);
  });
});

describe("las rutas de exámenes e informes", () => {
  const examen = { id: "ex-1", refereeId: "ref-1", puntuacionMaxima: 100 };

  it("borrar un examen: el fallo de escritura es un 500 con su mensaje, no un 404", async () => {
    getExams.mockResolvedValue([examen]);
    deleteExam.mockRejectedValue(new Error("referee_exams: deadlock detected"));
    const res = await borrarExamen(new Request("http://localhost/x", { method: "DELETE" }), ctx("ex-1"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "No se pudo eliminar el examen" });
  });

  it("editar un examen: ídem, y el que desapareció entre medias es un 404", async () => {
    getExams.mockResolvedValue([examen]);
    updateExam.mockRejectedValue(new Error("referee_exams: statement timeout"));
    let res = await editarExamen(json("PATCH", { notas: "Bien" }), ctx("ex-1"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "No se pudo actualizar el examen" });

    updateExam.mockResolvedValue(undefined);
    res = await editarExamen(json("PATCH", { notas: "Bien" }), ctx("ex-1"));
    expect(res.status).toBe(404);
  });

  it("borrar un informe: el fallo de escritura es un 500, no «Informe no encontrado»", async () => {
    getReport.mockResolvedValue({ id: "rep-1", zona: "CENTRO" });
    deleteReport.mockRejectedValue(new Error("referee_reports: deadlock detected"));
    const res = await borrarInforme(new Request("http://localhost/x", { method: "DELETE" }), ctx("rep-1"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "No se pudo eliminar el informe" });
  });
});
