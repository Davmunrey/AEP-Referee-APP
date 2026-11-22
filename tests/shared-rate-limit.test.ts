import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Límite de intentos compartido en la base (migración 046), con el cliente de
// servicio simulado: un mapa hace de tabla `rate_limit_hits`.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

const tabla = new Map<string, number>();
let rpcFalla = false;
const llamadas: { fn: string; args: Record<string, unknown> }[] = [];

const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  llamadas.push({ fn, args });
  if (rpcFalla) return { data: null, error: { message: "function rate_limit_peek does not exist" } };
  const key = String(args.p_key);
  if (fn === "rate_limit_peek") return { data: tabla.get(key) ?? 0, error: null };
  if (fn === "rate_limit_hit") {
    const n = (tabla.get(key) ?? 0) + 1;
    tabla.set(key, n);
    return { data: n, error: null };
  }
  if (fn === "rate_limit_clear") {
    tabla.delete(key);
    return { data: null, error: null };
  }
  return { data: null, error: { message: `rpc desconocida ${fn}` } };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const signInWithPassword = vi.fn(async () => ({ error: { message: "Invalid login credentials" } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}));

import {
  canAttemptLoginShared,
  clearLoginAttempts,
  clearLoginAttemptsShared,
  recordFailedLoginShared,
} from "@/lib/api/login-rate-limit";
import { allowActionShared, resetActionLimits } from "@/lib/api/action-rate-limit";
import { resetSharedRateLimitWarning, sharedKey } from "@/lib/api/shared-rate-limit";
import { POST as login } from "@/app/api/v1/auth/login/route";

/** Simula un arranque en frío: la memoria de la instancia se vacía. */
function arranqueEnFrio(ip: string, email: string) {
  clearLoginAttempts(ip, email);
  resetActionLimits();
}

beforeEach(() => {
  tabla.clear();
  llamadas.length = 0;
  rpcFalla = false;
  resetActionLimits();
  resetSharedRateLimitWarning();
  signInWithPassword.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clave compartida", () => {
  it("no guarda el e-mail ni la IP en claro y cabe en la columna", () => {
    const k = sharedKey("login:email:ana@example.com");
    expect(k).not.toContain("ana");
    expect(k).not.toContain("example");
    expect(k.length).toBeLessThanOrEqual(128);
    expect(sharedKey("login:email:ana@example.com")).toBe(k);
  });
});

describe("login con límite compartido", () => {
  const ip = "203.0.113.7";
  const email = "ana@example.com";

  it("sigue bloqueando tras un arranque en frío", async () => {
    for (let i = 0; i < 5; i++) await recordFailedLoginShared(ip, email);
    arranqueEnFrio(ip, email);
    const r = await canAttemptLoginShared(ip, email);
    expect(r.allowed).toBe(false);
  });

  it("un acierto limpia los contadores de esa cuenta", async () => {
    for (let i = 0; i < 5; i++) await recordFailedLoginShared(ip, email);
    await clearLoginAttemptsShared(ip, email);
    expect((await canAttemptLoginShared(ip, email)).allowed).toBe(true);
  });

  it("frena a una IP que prueba muchas cuentas distintas", async () => {
    for (let i = 0; i < 50; i++) {
      await recordFailedLoginShared(ip, `victima${i}@example.com`);
      arranqueEnFrio(ip, `victima${i}@example.com`);
    }
    expect((await canAttemptLoginShared(ip, "otra@example.com")).allowed).toBe(false);
    // Otra IP no está afectada.
    expect((await canAttemptLoginShared("198.51.100.1", "otra@example.com")).allowed).toBe(true);
  });

  it("si la base no responde, decide el límite en memoria y no bloquea a nadie", async () => {
    rpcFalla = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await canAttemptLoginShared(ip, "nuevo@example.com")).allowed).toBe(true);
    await recordFailedLoginShared(ip, "nuevo@example.com");
    expect((await canAttemptLoginShared(ip, "nuevo@example.com")).allowed).toBe(true);
    // Avisa una sola vez por instancia, no en cada petición.
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("la ruta de login responde 429 sin intentar la contraseña", async () => {
    for (let i = 0; i < 5; i++) await recordFailedLoginShared("unknown", email);
    arranqueEnFrio("unknown", email);
    const res = await login(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "x".repeat(10) }),
      }),
    );
    expect(res.status).toBe(429);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("un fallo de la ruta de login queda contado en la base", async () => {
    const res = await login(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "bea@example.com", password: "incorrecta" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(llamadas.filter((c) => c.fn === "rate_limit_hit")).toHaveLength(3);
  });
});

describe("allowActionShared", () => {
  it("cuenta entre instancias", async () => {
    for (let i = 0; i < 3; i++) expect(await allowActionShared("judge-code:ip:x", 3, 60_000)).toBe(true);
    resetActionLimits();
    expect(await allowActionShared("judge-code:ip:x", 3, 60_000)).toBe(false);
  });

  it("sin base, decide la memoria", async () => {
    rpcFalla = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 3; i++) expect(await allowActionShared("judge-code:ip:y", 3, 60_000)).toBe(true);
    expect(await allowActionShared("judge-code:ip:y", 3, 60_000)).toBe(false);
  });
});
