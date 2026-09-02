import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    createExam: vi.fn(),
    getReferee: vi.fn(),
    getApprovals: vi.fn(),
    reviewApproval: vi.fn(),
    getAnalytics: vi.fn(),
  },
}));

import { dataService } from "@/server/services";
import { POST as examsPost } from "@/app/api/v1/exams/route";
import { POST as reportsPost } from "@/app/api/v1/reports/route";
import { POST as approvalReview } from "@/app/api/v1/approvals/[id]/review/route";
import { GET as analyticsGet } from "@/app/api/v1/analytics/route";

type Mock = ReturnType<typeof vi.fn>;
const createExam = dataService.createExam as unknown as Mock;
const getApprovals = dataService.getApprovals as unknown as Mock;
const reviewApproval = dataService.reviewApproval as unknown as Mock;
const getAnalytics = dataService.getAnalytics as unknown as Mock;

const admin = { id: "u1", nombre: "Admin", role: "super_admin", zona: "CENTRO" };

function post(body: unknown) {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validExam = {
  refereeId: "j001",
  tipo: "Nuevo juez",
  nivelObjetivo: "Regional",
  fecha: "2026-09-01",
  examinador: "X",
};

beforeEach(() => {
  requireApiUser.mockReset();
  createExam.mockReset();
  getApprovals.mockReset();
  reviewApproval.mockReset();
  getAnalytics.mockReset();
  requireApiUser.mockResolvedValue(admin);
});

describe("POST /exams — validación y mapeo de errores de negocio", () => {
  it("tipo de examen desconocido → 400 (antes se persistía)", async () => {
    const res = await examsPost(post({ ...validExam, tipo: "Foo" }));
    expect(res.status).toBe(400);
    expect(createExam).not.toHaveBeenCalled();
  });

  it("fecha no ISO → 400 (antes reventaba en Postgres como 500)", async () => {
    const res = await examsPost(post({ ...validExam, fecha: "01/09/2026" }));
    expect(res.status).toBe(400);
  });

  it("puntuación máxima no numérica → 400 (antes NaN → violación NOT NULL)", async () => {
    const res = await examsPost(post({ ...validExam, puntuacionMaxima: "abc" }));
    expect(res.status).toBe(400);
  });

  it("juez inexistente lanzado por el servicio → 404, no 500", async () => {
    createExam.mockRejectedValue(new Error("Juez no encontrado"));
    const res = await examsPost(post(validExam));
    expect(res.status).toBe(404);
  });

  it("regla de nivel del servicio → 400, no 500", async () => {
    createExam.mockRejectedValue(new Error("Nuevo juez solo puede registrar nivel objetivo Regional"));
    const res = await examsPost(post({ ...validExam, nivelObjetivo: "Nacional" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /reports — enums validados", () => {
  it("subjectType desconocido → 400 (antes caía en la rama de competición)", async () => {
    const res = await reportsPost(
      post({ subjectType: "foo", competitionId: "evt-001", titulo: "t", tipo: "General", contenido: "c" }),
    );
    expect(res.status).toBe(400);
  });
  it("título no string → 400", async () => {
    const res = await reportsPost(
      post({ subjectType: "competicion", competitionId: "evt-001", titulo: 1, tipo: "General", contenido: "c" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /approvals/:id/review — 400/404/409", () => {
  const ctx = { params: Promise.resolve({ id: "apr-1" }) };

  it("body JSON `null` → 400 (antes TypeError → 500)", async () => {
    const res = await approvalReview(post(null), ctx);
    expect(res.status).toBe(400);
    expect(reviewApproval).not.toHaveBeenCalled();
  });

  it("propuesta inexistente → 404", async () => {
    getApprovals.mockResolvedValue([]);
    const res = await approvalReview(post({ approve: true }), ctx);
    expect(res.status).toBe(404);
  });

  it("propuesta ya revisada → 409 (antes 404 «no encontrada»)", async () => {
    getApprovals.mockResolvedValue([{ id: "apr-1", status: "aprobado" }]);
    const res = await approvalReview(post({ approve: true }), ctx);
    expect(res.status).toBe(409);
    expect(reviewApproval).not.toHaveBeenCalled();
  });

  it("approve: \"false\" no aprueba (antes Boolean(\"false\") === true)", async () => {
    getApprovals.mockResolvedValue([{ id: "apr-1", status: "pendiente" }]);
    reviewApproval.mockResolvedValue({ id: "apr-1", status: "rechazado" });
    await approvalReview(post({ approve: "false", comment: "no" }), ctx);
    expect(reviewApproval).toHaveBeenCalledWith("apr-1", false, "Admin", "u1", "no");
  });
});

describe("GET /analytics — ?year", () => {
  it("propaga el año solicitado al servicio (antes se ignoraba)", async () => {
    getAnalytics.mockResolvedValue({});
    await analyticsGet(new Request("http://localhost/api/v1/analytics?year=2025"));
    expect(getAnalytics).toHaveBeenCalledWith(admin, 2025);
  });
  it("año inválido → undefined (última temporada)", async () => {
    getAnalytics.mockResolvedValue({});
    await analyticsGet(new Request("http://localhost/api/v1/analytics?year=abc"));
    expect(getAnalytics).toHaveBeenCalledWith(admin, undefined);
  });
});
