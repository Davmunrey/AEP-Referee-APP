import { describe, expect, it } from "vitest";
import { POST as passwordRoute } from "@/app/api/v1/auth/password/route";

describe("POST /auth/password rate-limit gate", () => {
  it("rejects public fail/success manipulation", async () => {
    for (const action of ["fail", "success"] as const) {
      const res = await passwordRoute(
        new Request("http://localhost/api/v1/auth/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, email: "test@example.com" }),
        }),
      );
      expect(res.status).toBe(403);
    }
  });

  it("allows pre-login check", async () => {
    const res = await passwordRoute(
      new Request("http://localhost/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", email: "test@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
