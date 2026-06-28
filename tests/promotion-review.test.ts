import { beforeEach, describe, expect, it } from "vitest";
import type { PromotionRequest, Referee } from "@/lib/types";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { getStore } from "@/server/store";
import { reviewPromotion } from "@/server/services/memory-admin";

function referee(over: Partial<Referee> = {}): Referee {
  return {
    id: "ref-promo",
    nombre: "Juez Ascenso",
    zona: "CENTRO",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 10,
    ultimo: "2026-01-01",
    disp: true,
    iniciales: "JA",
    ...over,
  };
}

function pending(over: Partial<PromotionRequest> = {}): PromotionRequest {
  return {
    id: "pro-1",
    refereeId: "ref-promo",
    refereeName: "Juez Ascenso",
    fromLevel: "Regional",
    toLevel: "Nacional",
    zona: "CENTRO",
    status: "pendiente",
    submittedAt: "2026-01-01",
    eventosCompletados: 10,
    ...over,
  };
}

describe("reviewPromotion (memory)", () => {
  beforeEach(() => {
    const store = getStore();
    store.referees.length = 0;
    store.promotions.length = 0;
  });

  it("applies the promotion when it is an upgrade", () => {
    const store = getStore();
    store.referees.push(referee({ nivel: "Regional" }));
    store.promotions.push(pending({ fromLevel: "Regional", toLevel: "Nacional" }));
    return reviewPromotion("pro-1", true, "admin").then(() => {
      expect(store.referees[0]!.nivel).toBe("Nacional");
    });
  });

  it("does NOT downgrade a referee whose level already advanced past the request", () => {
    const store = getStore();
    // Solicitud antigua a "Nacional", pero el juez ya es "IPF Cat. 2".
    store.referees.push(referee({ nivel: "IPF Cat. 2" }));
    store.promotions.push(pending({ fromLevel: "Regional", toLevel: "Nacional" }));
    return reviewPromotion("pro-1", true, "admin").then(() => {
      expect(store.referees[0]!.nivel).toBe("IPF Cat. 2");
    });
  });

  it("does not change level when rejected", () => {
    const store = getStore();
    store.referees.push(referee({ nivel: "Regional" }));
    store.promotions.push(pending({ fromLevel: "Regional", toLevel: "Nacional" }));
    return reviewPromotion("pro-1", false, "admin").then(() => {
      expect(store.referees[0]!.nivel).toBe("Regional");
    });
  });

  it("persists rejection comment", async () => {
    const store = getStore();
    store.referees.push(referee({ nivel: "Regional" }));
    store.promotions.push(pending({ fromLevel: "Regional", toLevel: "Nacional" }));
    const result = await reviewPromotion("pro-1", false, "admin", "Faltan eventos");
    expect(result?.reviewComment).toBe("Faltan eventos");
  });
});
