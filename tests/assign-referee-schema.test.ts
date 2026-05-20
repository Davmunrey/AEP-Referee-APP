import { describe, expect, it } from "vitest";
import { assignRefereeSchema, clearSlotSchema } from "@/lib/validations";

describe("assignRefereeSchema", () => {
  it("accepts valid assign payload", () => {
    const parsed = assignRefereeSchema.parse({
      competitionId: "comp-1",
      slotKey: "S1_central_0",
      refereeId: "ref-1",
    });
    expect(parsed.slotKey).toBe("S1_central_0");
  });

  it("rejects empty refereeId", () => {
    expect(() =>
      assignRefereeSchema.parse({
        competitionId: "comp-1",
        slotKey: "S1_central_0",
        refereeId: "",
      }),
    ).toThrow();
  });
});

describe("clearSlotSchema", () => {
  it("requires slotKey", () => {
    expect(() => clearSlotSchema.parse({ competitionId: "c1", slotKey: "" })).toThrow();
  });
});
