import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getApprovals: vi.fn(),
    reviewApproval: vi.fn(),
  },
}));

import { dataService } from "@/server/services";
import { ApprovalReviewError } from "@/lib/competitions/service-types";
import { POST as approvalReview } from "@/app/api/v1/approvals/[id]/review/route";

type Mock = ReturnType<typeof vi.fn>;
const getApprovals = dataService.getApprovals as unknown as Mock;
const reviewApproval = dataService.reviewApproval as unknown as Mock;

const admin = { id: "u1", nombre: "Admin", role: "super_admin", zona: "CENTRO" };
const context = { params: Promise.resolve({ id: "apr-1" }) };

function post(body: unknown) {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireApiUser.mockReset();
  getApprovals.mockReset();
  reviewApproval.mockReset();
  requireApiUser.mockResolvedValue(admin);
  getApprovals.mockResolvedValue([{ id: "apr-1", status: "pendiente" }]);
});

describe("revisar una propuesta: qué motivo llega al cliente y cuál se queda en el log", () => {
  it("el motivo pensado para el revisor viaja tal cual, con 409", async () => {
    reviewApproval.mockRejectedValue(
      new ApprovalReviewError(
        "No se puede aprobar: 2 juez(ces) de la propuesta ya no existe(n) en el censo. Revisa la tarima y reenvíala.",
      ),
    );
    const res = await approvalReview(post({ approve: true }), {
      params: Promise.resolve({ id: "apr-1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/ya no existe\(n\) en el censo/);
  });

  it("un fallo de infraestructura no filtra el texto de Postgres ni finge un conflicto", async () => {
    // Antes: `jsonError(err.message, 409)` para CUALQUIER excepción, así que el
    // navegador recibía nombres de tabla y de restricción (CWE-209) etiquetados
    // como conflicto de revisión.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reviewApproval.mockRejectedValue(
      new Error(
        'insert or update on table "roster_history" violates foreign key constraint "roster_history_competition_id_fkey"',
      ),
    );
    const res = await approvalReview(post({ approve: true }), context);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("No se pudo revisar la propuesta");
    expect(JSON.stringify(body)).not.toMatch(/roster_history|fkey|constraint/);
    // Pero el detalle sí queda registrado en el servidor.
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0]?.[1] ?? "")).toMatch(/roster_history/);
    spy.mockRestore();
  });

  it("la aprobación correcta sigue devolviendo la propuesta revisada", async () => {
    reviewApproval.mockResolvedValue({ id: "apr-1", status: "aprobado" });
    const res = await approvalReview(post({ approve: true }), context);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { status: "aprobado" } });
  });
});
