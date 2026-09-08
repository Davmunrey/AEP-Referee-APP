import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
const updateUserById = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockTarget }) }) }),
    }),
    auth: { admin: { updateUserById } },
  }),
}));

import { POST } from "@/app/api/v1/admin/users/[id]/password/route";

let mockTarget: { id: string; role: string } | null = { id: "t1", role: "delegado_zona" };
const ctx = { params: Promise.resolve({ id: "t1" }) };
const body = (password: string) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ password }) });

beforeEach(() => {
  requireApiUser.mockReset();
  updateUserById.mockReset();
  updateUserById.mockResolvedValue({ error: null });
  mockTarget = { id: "t1", role: "delegado_zona" };
});

describe("POST /admin/users/:id/password (reset admin)", () => {
  it("403 si el usuario no puede gestionar usuarios", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", role: "delegado_zona", nombre: "Z" });
    const res = await POST(body("nuevapass8"), ctx);
    expect(res.status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("400 si la contraseña es demasiado corta", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", role: "super_admin", nombre: "A" });
    const res = await POST(body("corta"), ctx);
    expect(res.status).toBe(400);
  });

  it("403 si delegado_jueces intenta resetear a un super_admin", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", role: "delegado_jueces", nombre: "D" });
    mockTarget = { id: "t1", role: "super_admin" };
    const res = await POST(body("nuevapass8"), ctx);
    expect(res.status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("200 y actualiza cuando super_admin resetea a un usuario normal", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", role: "super_admin", nombre: "A" });
    const res = await POST(body("nuevapass8"), ctx);
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("t1", { password: "nuevapass8" });
  });

  it("un fallo del proveedor no viaja con su texto al navegador", async () => {
    // Antes: `No se pudo actualizar la contraseña: ${error.message}`, es decir
    // el detalle interno del proveedor de identidad en la respuesta (CWE-209).
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    requireApiUser.mockResolvedValue({ id: "u1", role: "super_admin", nombre: "A" });
    updateUserById.mockResolvedValue({
      error: { status: 500, message: "GoTrue: connection to db-abc123.internal refused" },
    });
    const res = await POST(body("nuevapass8"), ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("No se pudo actualizar la contraseña. Vuelve a intentarlo.");
    expect(JSON.stringify(json)).not.toMatch(/GoTrue|internal/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("una contraseña que no cumple la política es 400, no 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    requireApiUser.mockResolvedValue({ id: "u1", role: "super_admin", nombre: "A" });
    updateUserById.mockResolvedValue({
      error: { status: 422, code: "weak_password", message: "Password is known to be weak" },
    });
    const res = await POST(body("password123"), ctx);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("política de seguridad"),
    });
    spy.mockRestore();
  });
});
