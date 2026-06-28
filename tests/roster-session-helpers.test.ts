import { describe, expect, it } from "vitest";
import { assignedRefereeIdsInSession } from "@/components/competitions/roster-session-helpers";

describe("assignedRefereeIdsInSession", () => {
  const assignments = {
    S1_jurado_0: "ref-a",
    S1_mesa_0: "ref-b",
    S2_jurado_0: "ref-a",
    S2_mesa_0: "ref-c",
  };

  it("returns only referees assigned in the requested session", () => {
    expect(assignedRefereeIdsInSession(assignments, "S1")).toEqual(new Set(["ref-a", "ref-b"]));
    expect(assignedRefereeIdsInSession(assignments, "S2")).toEqual(new Set(["ref-a", "ref-c"]));
  });

  it("returns empty set when session is missing or unknown", () => {
    expect(assignedRefereeIdsInSession(assignments, "S3")).toEqual(new Set());
    expect(assignedRefereeIdsInSession(assignments, null)).toEqual(new Set());
    expect(assignedRefereeIdsInSession(assignments, undefined)).toEqual(new Set());
  });
});
