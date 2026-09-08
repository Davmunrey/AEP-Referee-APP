import { beforeEach, describe, expect, it, vi } from "vitest";

// Revisar un ascenso son DOS escrituras: marcar la solicitud y subir el nivel
// del juez. La segunda iba sin comprobar, y la ruta no tenía `try/catch`, así
// que un ascenso podía quedar «aprobado» con el juez en su nivel de siempre y
// nadie enterarse.

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string };

let respond: (ctx: Call) => QueryResult;
let calls: Call[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const finish = () => {
        calls.push({ ...state });
        return respond(state);
      };
      const q = {
        select: () => q,
        update: () => ((state.op = "update"), q),
        insert: () => ((state.op = "insert"), q),
        upsert: () => ((state.op = "upsert"), q),
        delete: () => ((state.op = "delete"), q),
        eq: () => q,
        in: () => q,
        order: () => q,
        limit: () => q,
        single: async () => finish(),
        maybeSingle: async () => finish(),
        range: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

const requireApiUser = vi.fn();
const reviewPromotion = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getPromotions: async () => [{ id: "pro-1", status: "pendiente" }],
    reviewPromotion: (...args: unknown[]) => reviewPromotion(...args),
  },
}));

import { examsService } from "@/server/services/supabase-exams";
import { PromotionReviewError } from "@/lib/competitions/service-types";
import { POST as revisarAscenso } from "@/app/api/v1/promotions/[id]/review/route";

const SOLICITUD = {
  id: "pro-1",
  referee_id: "j1",
  referee_name: "Ana Ruiz",
  from_level: "Regional",
  to_level: "Nacional",
  status: "pendiente",
  zona: "CENTRO",
  submitted_at: "2026-02-01",
};

type Fallo = "claim" | "nivel" | "nivel-carrera" | "reread";

function escenario(fallo?: Fallo) {
  respond = ({ table, op }) => {
    if (table === "promotion_requests") {
      if (op === "update") {
        if (fallo === "claim") return { data: null, error: { message: "deadlock detected" } };
        return { data: [{ id: "pro-1" }], error: null };
      }
      // La primera lectura es la solicitud pendiente; la segunda, la relectura
      // posterior a la revisión.
      const previas = calls.filter((c) => c.table === "promotion_requests" && c.op === "select");
      if (previas.length <= 1) return { data: SOLICITUD, error: null };
      if (fallo === "reread") return { data: null, error: { message: "statement timeout" } };
      return { data: { ...SOLICITUD, status: "aprobado" }, error: null };
    }
    if (table === "referees") {
      if (op === "update") {
        if (fallo === "nivel") {
          return { data: null, error: { message: 'null value in column "nivel" violates' } };
        }
        // Carrera: el nivel cambió por debajo y el compare-and-set no casa.
        return { data: fallo === "nivel-carrera" ? [] : [{ id: "j1" }], error: null };
      }
      return { data: { id: "j1", nivel: "Regional" }, error: null };
    }
    return { data: [], error: null };
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("aprobar un ascenso cuando algo falla por debajo", () => {
  it("el camino normal sube el nivel y devuelve la solicitud", async () => {
    escenario();
    const req = await examsService.reviewPromotion("pro-1", true, "Revisor");
    expect(req?.status).toBe("aprobado");
    expect(calls.filter((c) => c.table === "referees" && c.op === "update")).toHaveLength(1);
  });

  it("si la solicitud no llega a marcarse, no se finge que ganó otro revisor", async () => {
    // Antes el error de escritura salía por la misma puerta que la carrera
    // perdida (`data` vacío → `undefined` → «ya fue revisada por otro»), sobre
    // una solicitud que en realidad seguía pendiente.
    escenario("claim");
    await expect(examsService.reviewPromotion("pro-1", true, "Revisor")).rejects.toThrow(
      /sigue pendiente/,
    );
    // Y no se ha tocado el nivel de nadie.
    expect(calls.some((c) => c.table === "referees" && c.op === "update")).toBe(false);
  });

  it("si el nivel no llega a cambiar, se dice que el ascenso quedó a medias", async () => {
    escenario("nivel");
    const err = await examsService
      .reviewPromotion("pro-1", true, "Revisor")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PromotionReviewError);
    expect((err as Error).message).toMatch(/no llegó a cambiar a Nacional/);
    // El detalle de Postgres se queda en el log.
    expect((err as Error).message).not.toMatch(/null value in column/);
  });

  it("si otro cambió el nivel mientras tanto, tampoco se da por hecho", async () => {
    escenario("nivel-carrera");
    await expect(examsService.reviewPromotion("pro-1", true, "Revisor")).rejects.toThrow(
      /cambió mientras se revisaba/,
    );
  });

  it("un fallo al releer no arrastra el texto de Postgres", async () => {
    escenario("reread");
    const err = await examsService
      .reviewPromotion("pro-1", true, "Revisor")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PromotionReviewError);
    expect((err as Error).message).not.toMatch(/statement timeout/);
  });
});

// ── La ruta: el motivo tiene que llegar al revisor ───────────────────────────
// `POST /promotions/:id/review` no tenía `try/catch`: cualquier excepción del
// servicio salía como un 500 sin texto y el revisor solo veía «error».
describe("POST /promotions/:id/review", () => {
  const peticion = (body: unknown) =>
    new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
  const ctx = () => ({ params: Promise.resolve({ id: "pro-1" }) });

  beforeEach(() => {
    requireApiUser.mockReset();
    reviewPromotion.mockReset();
    requireApiUser.mockResolvedValue({
      id: "u1",
      nombre: "Admin",
      role: "super_admin",
      zona: "CENTRO",
    });
  });

  it("el motivo pensado para el revisor viaja tal cual, con 409", async () => {
    reviewPromotion.mockRejectedValue(
      new PromotionReviewError(
        "No se puede aprobar: el juez de la solicitud ya no existe en el censo.",
      ),
    );
    const res = await revisarAscenso(peticion({ approve: true }), ctx());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("ya no existe en el censo"),
    });
  });

  it("un fallo de infraestructura sale genérico y sin texto de Postgres", async () => {
    reviewPromotion.mockRejectedValue(new Error('relation "promotion_requests" does not exist'));
    const res = await revisarAscenso(peticion({ approve: true }), ctx());
    expect(res.status).toBe(500);
    const cuerpo = await res.json();
    expect(cuerpo.error).toBe("No se pudo revisar la solicitud");
    expect(JSON.stringify(cuerpo)).not.toMatch(/promotion_requests|relation/);
  });

  it("`approve: \"false\"` ya no aprueba", async () => {
    // `Boolean("false")` es true: la cadena aprobaba el ascenso. Ahora cuenta
    // como rechazo y, sin motivo escrito, se corta antes de tocar nada.
    const res = await revisarAscenso(peticion({ approve: "false" }), ctx());
    expect(res.status).toBe(400);
    expect(reviewPromotion).not.toHaveBeenCalled();
  });

  it("la aprobación correcta devuelve la solicitud revisada", async () => {
    reviewPromotion.mockResolvedValue({ id: "pro-1", status: "aprobado" });
    const res = await revisarAscenso(peticion({ approve: true }), ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { status: "aprobado" } });
  });
});
