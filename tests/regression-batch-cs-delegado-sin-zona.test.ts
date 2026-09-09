import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Un delegado de zona SIN zona asignada no puede actuar: es la regla que ya
 * aplican `assertRefereeInUserZone` («Fail-closed…») y `canManageSanctions`.
 *
 * Varias guardas la escribían como `user.role === "delegado_zona" && user.zona
 * && !casa(...)`, y ese `&& user.zona` se salta la comprobación ENTERA cuando
 * no hay zona: el mismo usuario al que se le niega tocar la ficha de un juez
 * podía leer el historial disciplinario de cualquiera y crear o editar
 * informes de cualquier zona.
 *
 * (El BORRADO de informes no estaba expuesto: `canAdminJudges` ya deja fuera
 * a los delegados de zona antes de llegar a la comprobación. Su guarda de zona
 * se alinea igualmente para que las tres digan lo mismo.)
 *
 * Un perfil así no lo crea la pantalla de cuentas —exige zona para ese rol—,
 * pero sí lo dejan una fila anterior a esa regla o una edición a mano en
 * Supabase, que es exactamente cuando una guarda tiene que aguantar.
 */

const requireApiUser = vi.fn();
const getReferee = vi.fn();
const getReport = vi.fn();
const getCompetition = vi.fn();
const listRefereeSanctions = vi.fn();
const updateReport = vi.fn();
const deleteReport = vi.fn();
const createReport = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getReferee: (...a: unknown[]) => getReferee(...a),
    getReport: (...a: unknown[]) => getReport(...a),
    getCompetition: (...a: unknown[]) => getCompetition(...a),
    listRefereeSanctions: (...a: unknown[]) => listRefereeSanctions(...a),
    updateReport: (...a: unknown[]) => updateReport(...a),
    deleteReport: (...a: unknown[]) => deleteReport(...a),
    createReport: (...a: unknown[]) => createReport(...a),
  },
}));

const { GET: leerSanciones } = await import("@/app/api/v1/referees/[id]/sanctions/route");
const { PATCH: editarInforme, DELETE: borrarInforme } = await import(
  "@/app/api/v1/reports/[id]/route"
);
const { POST: crearInforme } = await import("@/app/api/v1/reports/route");

const SIN_ZONA = {
  id: "u1",
  nombre: "Dele Gado",
  iniciales: "DG",
  email: "d@aep.test",
  rol: "Delegado de zona",
  role: "delegado_zona" as const,
  zona: "",
};
const CON_ZONA = { ...SIN_ZONA, zona: "CENTRO" };

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (method: string, body: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  getReferee.mockResolvedValue({ id: "ref-1", nombre: "Juez del Norte", zona: "NORTE" });
  getReport.mockResolvedValue({ id: "rep-1", zona: "NORTE", titulo: "t", contenido: "c" });
  getCompetition.mockResolvedValue({ id: "evt-1", zona: "NORTE" });
  listRefereeSanctions.mockResolvedValue([]);
  updateReport.mockResolvedValue({ id: "rep-1" });
  deleteReport.mockResolvedValue(true);
  createReport.mockResolvedValue({ id: "rep-9" });
});

describe("un delegado de zona sin zona asignada", () => {
  it("no puede leer el historial disciplinario de un juez de otra zona", async () => {
    requireApiUser.mockResolvedValue(SIN_ZONA);
    const res = await leerSanciones(new Request("http://localhost/x"), ctx("ref-1"));
    expect(res.status).toBe(403);
    expect(listRefereeSanctions).not.toHaveBeenCalled();
  });

  it("no puede editar un informe de otra zona", async () => {
    requireApiUser.mockResolvedValue(SIN_ZONA);
    const res = await editarInforme(json("PATCH", { contenido: "otro" }), ctx("rep-1"));
    expect(res.status).toBe(403);
    expect(updateReport).not.toHaveBeenCalled();
  });

  it("no puede crear un informe sobre un campeonato de otra zona", async () => {
    requireApiUser.mockResolvedValue(SIN_ZONA);
    const res = await crearInforme(
      json("POST", {
        subjectType: "competicion",
        competitionId: "evt-1",
        titulo: "Título del informe",
        tipo: "Juez",
        contenido: "Contenido del informe con longitud suficiente.",
        autor: "Dele Gado",
      }),
    );
    expect(res.status).toBe(403);
    expect(createReport).not.toHaveBeenCalled();
  });
});

describe("un delegado con su zona bien puesta", () => {
  it("sigue sin poder editar lo de otra zona", async () => {
    requireApiUser.mockResolvedValue(CON_ZONA);
    const res = await editarInforme(json("PATCH", { contenido: "otro" }), ctx("rep-1"));
    expect(res.status).toBe(403);
    expect(updateReport).not.toHaveBeenCalled();
  });

  it("y sí puede con lo suyo", async () => {
    requireApiUser.mockResolvedValue(CON_ZONA);
    getReport.mockResolvedValue({ id: "rep-2", zona: "CENTRO", titulo: "t", contenido: "c" });
    const res = await editarInforme(json("PATCH", { contenido: "Contenido corregido." }), ctx("rep-2"));
    expect(res.status).toBe(200);
    expect(updateReport).toHaveBeenCalled();
  });

  it("y el borrado ya lo cortaba antes el permiso de rol, no la zona", async () => {
    requireApiUser.mockResolvedValue(CON_ZONA);
    getReport.mockResolvedValue({ id: "rep-2", zona: "CENTRO", titulo: "t", contenido: "c" });
    const res = await borrarInforme(new Request("http://localhost/x", { method: "DELETE" }), ctx("rep-2"));
    expect(res.status).toBe(403);
    expect(deleteReport).not.toHaveBeenCalled();
  });
});
