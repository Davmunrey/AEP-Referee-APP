import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
const registerDeviceToken = vi.fn();
const removeDeviceToken = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/notifications/device-tokens", () => ({
  registerDeviceToken: (r: unknown) => registerDeviceToken(r),
  removeDeviceToken: (u: string, t: string) => removeDeviceToken(u, t),
}));

import { POST } from "@/app/api/v1/devices/route";
import { DELETE } from "@/app/api/v1/devices/[token]/route";

const postBody = (body: unknown) =>
  new Request("http://localhost/api/v1/devices", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  requireApiUser.mockReset();
  registerDeviceToken.mockReset();
  removeDeviceToken.mockReset();
  registerDeviceToken.mockResolvedValue(undefined);
  removeDeviceToken.mockResolvedValue(undefined);
  requireApiUser.mockResolvedValue({ id: "u1", role: "solo_ver", nombre: "Z" });
});

describe("POST /api/v1/devices", () => {
  it("401 si no hay sesión válida", async () => {
    requireApiUser.mockResolvedValue(new Response(null, { status: 401 }));
    const res = await POST(postBody({ apnsToken: "abc" }));
    expect(res.status).toBe(401);
    expect(registerDeviceToken).not.toHaveBeenCalled();
  });

  it("400 si falta apnsToken", async () => {
    const res = await POST(postBody({ environment: "production" }));
    expect(res.status).toBe(400);
    expect(registerDeviceToken).not.toHaveBeenCalled();
  });

  it("registra el token para el usuario autenticado (cualquier rol, incl. solo_ver)", async () => {
    const res = await POST(
      postBody({ apnsToken: "  tok-123  ", environment: "sandbox", deviceModel: "iPhone16,2" }),
    );
    expect(res.status).toBe(200);
    expect(registerDeviceToken).toHaveBeenCalledWith({
      userId: "u1",
      apnsToken: "tok-123",
      environment: "sandbox",
      deviceModel: "iPhone16,2",
      appVersion: undefined,
      locale: undefined,
    });
  });

  it("usa environment 'production' por defecto ante valores no válidos", async () => {
    await POST(postBody({ apnsToken: "tok", environment: "raro" }));
    expect(registerDeviceToken).toHaveBeenCalledWith(
      expect.objectContaining({ environment: "production" }),
    );
  });
});

describe("DELETE /api/v1/devices/:token", () => {
  const ctx = (token: string) => ({ params: Promise.resolve({ token }) });

  it("401 si no hay sesión válida", async () => {
    requireApiUser.mockResolvedValue(new Response(null, { status: 401 }));
    const res = await DELETE(new Request("http://localhost/x"), ctx("tok"));
    expect(res.status).toBe(401);
    expect(removeDeviceToken).not.toHaveBeenCalled();
  });

  it("elimina el token (decodificando la URL) para el usuario autenticado", async () => {
    const res = await DELETE(new Request("http://localhost/x"), ctx("tok%2B123"));
    expect(res.status).toBe(200);
    expect(removeDeviceToken).toHaveBeenCalledWith("u1", "tok+123");
  });
});
