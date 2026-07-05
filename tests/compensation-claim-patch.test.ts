import { describe, expect, it } from "vitest";
import { normalizeCompensationClaimPatch } from "@/lib/judge-compensation/claim-patch";

describe("normalizeCompensationClaimPatch — distancia", () => {
  it("derivar el i+v desde la ida", () => {
    const out = normalizeCompensationClaimPatch({ distanceKmOneWay: 50 });
    expect(out.distanceKmOneWay).toBe(50);
    expect(out.distanceKmRoundTrip).toBe(100);
  });

  it("limpiar la ida (null) limpia también el i+v — antes quedaba obsoleto", () => {
    const out = normalizeCompensationClaimPatch({ distanceKmOneWay: null });
    expect(out.distanceKmOneWay).toBeNull();
    expect(out.distanceKmRoundTrip).toBeNull();
  });

  it("derivar la ida desde el i+v y limpiar ambos al poner i+v a null", () => {
    expect(normalizeCompensationClaimPatch({ distanceKmRoundTrip: 100 }).distanceKmOneWay).toBe(50);
    const cleared = normalizeCompensationClaimPatch({ distanceKmRoundTrip: null });
    expect(cleared.distanceKmOneWay).toBeNull();
    expect(cleared.distanceKmRoundTrip).toBeNull();
  });
});
