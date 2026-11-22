import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEXT_MAX, textTooLong } from "@/lib/api/text-limits";

describe("textTooLong", () => {
  it("devuelve el primer campo que se pasa, con su etiqueta", () => {
    const msg = textTooLong(
      { titulo: "x".repeat(201), contenido: "ok" },
      { titulo: { max: 200, label: "El título" }, contenido: { max: 10, label: "El contenido" } },
    );
    expect(msg).toBe("El título no puede superar 200 caracteres");
  });

  it("ignora campos ausentes o de otro tipo y acepta el límite exacto", () => {
    expect(textTooLong({ a: 5, b: "x".repeat(10) }, { a: { max: 1, label: "A" }, b: { max: 10, label: "B" } })).toBeNull();
    expect(textTooLong(null, { a: { max: 1, label: "A" } })).toBeNull();
  });
});

// Las rutas de edición rechazan textos desmesurados antes de tocar la base.

const requireApiUser = vi.fn();
const updateReport = vi.fn();
const getReport = vi.fn();
const createPromotion = vi.fn();
const getReferee = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    updateReport: (...a: unknown[]) => updateReport(...a),
    getReport: (...a: unknown[]) => getReport(...a),
    createPromotion: (...a: unknown[]) => createPromotion(...a),
    getReferee: (...a: unknown[]) => getReferee(...a),
  },
}));

const { PATCH: patchReport } = await import("@/app/api/v1/reports/[id]/route");
const { POST: postPromotion } = await import("@/app/api/v1/promotions/route");

const req = (body: unknown) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: "r1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue({ id: "u1", email: "a@b.c", role: "super_admin", nombre: "Admin" });
  getReport.mockResolvedValue({ id: "r1", zona: "CENTRO" });
  updateReport.mockResolvedValue({ id: "r1" });
  getReferee.mockResolvedValue({ id: "j1", zona: "CENTRO" });
  createPromotion.mockResolvedValue({ id: "p1" });
});

describe("rutas con topes de texto", () => {
  it("un informe con contenido desmesurado es 400 y no se guarda", async () => {
    const res = await patchReport(req({ contenido: "x".repeat(TEXT_MAX.contenido + 1) }), ctx);
    expect(res.status).toBe(400);
    expect(updateReport).not.toHaveBeenCalled();
  });

  it("un informe dentro de los límites se guarda", async () => {
    const res = await patchReport(req({ contenido: "Texto normal" }), ctx);
    expect(res.status).toBe(200);
    expect(updateReport).toHaveBeenCalled();
  });

  it("un motivo de ascenso desmesurado es 400", async () => {
    const res = await postPromotion(
      req({ refereeId: "j1", toLevel: "Nacional", motivo: "x".repeat(TEXT_MAX.motivo + 1) }),
    );
    expect(res.status).toBe(400);
    expect(createPromotion).not.toHaveBeenCalled();
  });
});
