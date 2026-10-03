import { beforeEach, describe, expect, it, vi } from "vitest";

// Lote de la auditoría de producto pantalla a pantalla (2026-10). Cada bloque
// salió de USAR la aplicación —servidor local, navegador y la API— y no de
// leer el código; cada test falla con el comportamiento anterior.

const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getApprovals: vi.fn(),
    reviewApproval: vi.fn(),
    getPromotions: vi.fn(),
    reviewPromotion: vi.fn(),
    createReferee: vi.fn(),
    getReferee: vi.fn(),
    updateReferee: vi.fn(),
  },
}));

import { dataService } from "@/server/services";
import { POST as approvalReview } from "@/app/api/v1/approvals/[id]/review/route";
import { POST as promotionReview } from "@/app/api/v1/promotions/[id]/review/route";
import { POST as refereesPost } from "@/app/api/v1/referees/route";
import { PATCH as refereePatch } from "@/app/api/v1/referees/[id]/route";
import { touchesPaidAmount } from "@/lib/judge-compensation/claim-patch";
import { getPageMeta } from "@/lib/navigation";

type Mock = ReturnType<typeof vi.fn>;
const m = (f: unknown) => f as Mock;
const admin = { id: "u1", nombre: "Admin", role: "super_admin", zona: "CENTRO" };
const ctx = { params: Promise.resolve({ id: "x-1" }) };

function req(method: string, body: unknown) {
  return new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  for (const f of Object.values(dataService)) m(f).mockReset();
  requireApiUser.mockReset();
  requireApiUser.mockResolvedValue(admin);
  m(dataService.getApprovals).mockResolvedValue([{ id: "x-1", status: "pendiente" }]);
  m(dataService.getPromotions).mockResolvedValue([{ id: "x-1", status: "pendiente" }]);
});

describe("revisar una propuesta exige una decisión explícita", () => {
  // `approve` era `body.approve === true`: una petición sin el campo RECHAZABA
  // la tarima, sin motivo, y la devolvía a su zona.
  it("sin `approve` no se rechaza: 400 y no se toca la propuesta", async () => {
    const res = await approvalReview(req("POST", { comment: "ok" }), ctx);
    expect(res.status).toBe(400);
    expect(dataService.reviewApproval).not.toHaveBeenCalled();
  });

  it("rechazar sin motivo es un 400, como ya pasaba en ascensos", async () => {
    const res = await approvalReview(req("POST", { approve: false }), ctx);
    expect(res.status).toBe(400);
    expect(dataService.reviewApproval).not.toHaveBeenCalled();
  });

  it("rechazar con motivo sigue funcionando", async () => {
    m(dataService.reviewApproval).mockResolvedValue({ id: "x-1", status: "rechazado" });
    const res = await approvalReview(req("POST", { approve: false, comment: "falta un central" }), ctx);
    expect(res.status).toBe(200);
    expect(dataService.reviewApproval).toHaveBeenCalledWith("x-1", false, "Admin", "u1", "falta un central");
  });

  it("aprobar sin comentario sigue funcionando", async () => {
    m(dataService.reviewApproval).mockResolvedValue({ id: "x-1", status: "aprobado" });
    const res = await approvalReview(req("POST", { approve: true }), ctx);
    expect(res.status).toBe(200);
  });

  it("en ascensos, igual: sin decisión no hay revisión", async () => {
    const res = await promotionReview(req("POST", { comment: "motivo" }), ctx);
    expect(res.status).toBe(400);
    expect(dataService.reviewPromotion).not.toHaveBeenCalled();
  });
});

describe("la zona de un juez tiene que existir", () => {
  // Los campeonatos ya respondían «Zona no válida»; los jueces aceptaban
  // cualquier texto: en memoria el juez quedaba invisible para los delegados y
  // en Supabase la clave ajena reventaba con un 500.
  const base = { nombre: "Nuevo", nivel: "Regional", estado: "Activo" };

  it("al crear: zona inexistente → 400", async () => {
    const res = await refereesPost(req("POST", { ...base, zona: "Inventada" }));
    expect(res.status).toBe(400);
    expect(dataService.createReferee).not.toHaveBeenCalled();
  });

  it("al crear: un alias válido se guarda como código canónico", async () => {
    m(dataService.createReferee).mockResolvedValue({ id: "j9" });
    await refereesPost(req("POST", { ...base, zona: "2- CENTRO" }));
    expect(m(dataService.createReferee).mock.calls[0]![0].zona).toBe("CENTRO");
  });

  it("al editar: zona inexistente → 400", async () => {
    m(dataService.getReferee).mockResolvedValue({ id: "x-1", zona: "CENTRO", nombre: "A" });
    const res = await refereePatch(req("PATCH", { zona: "Inventada" }), ctx);
    expect(res.status).toBe(400);
    expect(dataService.updateReferee).not.toHaveBeenCalled();
  });
});

describe("una liquidación pagada no cambia de importe", () => {
  const pagada = { status: "pagado" as const };

  it("los campos que mueven dinero quedan bloqueados", () => {
    for (const patch of [
      { distanceKmRoundTrip: 10 },
      { travelMode: "none" as const },
      { lodgingDaysOverride: 2 },
      { isCompetitionManager: true },
      { computerSetupAmount: 30 },
      { travelAmountOverride: 5 },
    ]) {
      expect(touchesPaidAmount(pagada, patch), JSON.stringify(patch)).toBe(true);
    }
  });

  it("cambiar de estado y km a la vez tampoco desbloquea", () => {
    expect(touchesPaidAmount(pagada, { status: "aprobado", distanceKmRoundTrip: 10 })).toBe(true);
  });

  it("estado y notas sí se pueden tocar", () => {
    expect(touchesPaidAmount(pagada, { status: "aprobado" })).toBe(false);
    expect(touchesPaidAmount(pagada, { reviewComment: "transferencia 3/10" })).toBe(false);
    expect(touchesPaidAmount(pagada, { travelNotes: "tren" })).toBe(false);
  });

  it("sin pagar, todo se puede editar", () => {
    expect(touchesPaidAmount({ status: "aprobado" }, { distanceKmRoundTrip: 10 })).toBe(false);
  });
});

describe("cabecera de las páginas de soporte", () => {
  // Caían en el genérico y la barra decía «AEP Tarima › AEP Tarima».
  it("/tickets y /tickets/[id] tienen título y miga propios", () => {
    expect(getPageMeta("/tickets").title).toBe("Soporte");
    expect(getPageMeta("/tickets/tick-1").crumbs.map((c) => c.label)).toEqual([
      "AEP Tarima",
      "Soporte",
      "Ticket",
    ]);
  });
});
