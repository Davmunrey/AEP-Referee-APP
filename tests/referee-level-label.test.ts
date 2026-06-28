import { describe, expect, it } from "vitest";
import { abbreviateRefereeLevel } from "@/lib/referee-level-label";

describe("abbreviateRefereeLevel", () => {
  it("abrevia los cuatro niveles arbitrales", () => {
    expect(abbreviateRefereeLevel("Regional")).toBe("R");
    expect(abbreviateRefereeLevel("Nacional")).toBe("N");
    expect(abbreviateRefereeLevel("IPF Cat. 1")).toBe("I");
    expect(abbreviateRefereeLevel("IPF Cat. 2")).toBe("II");
  });
});
