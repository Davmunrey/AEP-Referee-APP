import { describe, expect, it } from "vitest";
import { checkRosterMutationAllowed } from "@/lib/roster-route-guards";

describe("checkRosterMutationAllowed", () => {
  const future = {
    fecha: "2099-06-01",
    fechaFin: "2099-06-02",
  };

  it("allows edit when competition exists and user can edit", () => {
    expect(checkRosterMutationAllowed(future, true)).toEqual({ ok: true });
  });

  it("404 when competition missing", () => {
    const r = checkRosterMutationAllowed(null, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("403 when user cannot edit zone", () => {
    const r = checkRosterMutationAllowed(future, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("423 when competition is past", () => {
    const r = checkRosterMutationAllowed(
      { fecha: "2020-01-01", fechaFin: "2020-01-02" },
      true,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(423);
      expect(r.error).toContain("solo lectura");
    }
  });
});
