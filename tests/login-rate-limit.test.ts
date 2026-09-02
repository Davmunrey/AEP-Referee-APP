import { describe, expect, it } from "vitest";
import {
  loginRateLimitKey,
  MAX_LOGIN_EMAIL_LENGTH,
  requestIp,
} from "@/lib/api/login-rate-limit";
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

// El email llega sin autenticar y se usa como clave de los buckets del
// rate-limit, así que su longitud tiene que estar acotada: sin tope, un email
// enorme por intento fallido hinchaba la memoria del proceso, y el propio
// rate-limit no lo frenaba porque cada email distinto estrena bucket.
describe("cotas de longitud en las entradas públicas", () => {
  const largo = `${"a".repeat(MAX_LOGIN_EMAIL_LENGTH)}@example.com`;

  it("rechaza un email desmesurado en la comprobación previa", async () => {
    const res = await passwordRoute(
      new Request("http://localhost/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", email: largo }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("un email de longitud legítima sigue pasando", async () => {
    const res = await passwordRoute(
      new Request("http://localhost/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", email: "a@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("la clave del bucket queda acotada aunque el email no lo esté", () => {
    // `normalizeEmail` recorta, así que dos emails gigantes distintos no pueden
    // fabricar claves de longitud arbitraria.
    const key = loginRateLimitKey("203.0.113.1", `${"b".repeat(5000)}@example.com`);
    expect(key.length).toBeLessThanOrEqual(45 + 1 + MAX_LOGIN_EMAIL_LENGTH);
  });

  it("la IP de la cabecera tampoco puede inflar la clave", () => {
    // `x-forwarded-for` la controla el cliente en un endpoint público.
    const key = loginRateLimitKey("9".repeat(5000), "a@example.com");
    expect(key.length).toBeLessThanOrEqual(5000 + 1 + MAX_LOGIN_EMAIL_LENGTH);
    expect(
      requestIp(
        new Request("http://localhost/api/v1/auth/login", {
          headers: { "x-forwarded-for": "9".repeat(5000) },
        }),
      ).length,
    ).toBeLessThanOrEqual(45);
  });
});
