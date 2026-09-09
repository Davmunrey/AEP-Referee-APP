import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
const updateUserById = vi.fn();
const deleteUser = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseUrl: () => "https://test.supabase.co",
  getSupabaseAnonKey: () => "anon-key",
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: objetivo }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    auth: { admin: { updateUserById, deleteUser } },
  }),
}));
vi.mock("@/server/services/admin-audit", () => ({ recordAccessChange: async () => {} }));

import { POST as cambiarContrasena } from "@/app/api/v1/auth/change-password/route";
import { DELETE as borrarUsuario } from "@/app/api/v1/admin/users/[id]/route";

let objetivo: { id: string; role: string; nombre?: string } | null = null;

const admin = { id: "u1", nombre: "Admin", role: "super_admin", email: "a@aep.es" };
const peticion = (body: unknown) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
const ctx = () => ({ params: Promise.resolve({ id: "t1" }) });

beforeEach(() => {
  requireApiUser.mockReset();
  updateUserById.mockReset();
  deleteUser.mockReset();
  signInWithPassword.mockReset();
  signOut.mockReset();
  requireApiUser.mockResolvedValue(admin);
  signInWithPassword.mockResolvedValue({ error: null });
  updateUserById.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  objetivo = { id: "t1", role: "delegado_zona", nombre: "Zoe" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cambiar la contraseña echa a quien esté dentro con la anterior", () => {
  it("cierra las demás sesiones y conserva la actual", async () => {
    // Sin esto, una sesión robada seguía viva después del cambio: el usuario
    // cree que ha cerrado la puerta y sigue abierta hasta que caduque el token.
    const res = await cambiarContrasena(
      peticion({ currentPassword: "actual12", newPassword: "nueva1234" }),
    );
    expect(res.status).toBe(200);
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    await expect(res.json()).resolves.toMatchObject({
      data: { updated: true, otrasSesionesCerradas: true },
    });
  });

  it("si el cierre falla, la contraseña YA está cambiada y se dice", async () => {
    signOut.mockResolvedValue({ error: { message: "network" } });
    const res = await cambiarContrasena(
      peticion({ currentPassword: "actual12", newPassword: "nueva1234" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { updated: true, otrasSesionesCerradas: false },
    });
  });
});

describe("las contraseñas tienen el mismo tope que en el login", () => {
  it("una contraseña desmesurada se corta antes de llegar al proveedor", async () => {
    // `/auth/login` lleva el tope porque bcrypt solo usa 72 bytes y sin cota se
    // puede hacer hashear megabytes por petición. Aquí faltaba, y son DOS
    // contraseñas las que salen hacia el proveedor.
    const enorme = "a".repeat(5000);
    const res = await cambiarContrasena(
      peticion({ currentPassword: enorme, newPassword: "nueva1234" }),
    );
    expect(res.status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();

    const res2 = await cambiarContrasena(
      peticion({ currentPassword: "actual12", newPassword: enorme }),
    );
    expect(res2.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("los mensajes del proveedor de identidad no salen al navegador", () => {
  it("al cambiar la contraseña", async () => {
    updateUserById.mockResolvedValue({
      error: { status: 500, message: "GoTrue: connection to db-abc123.internal refused" },
    });
    const res = await cambiarContrasena(
      peticion({ currentPassword: "actual12", newPassword: "nueva1234" }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/GoTrue|internal/);
  });

  it("y una contraseña que no cumple la política es 400, no 500", async () => {
    updateUserById.mockResolvedValue({
      error: { status: 422, code: "weak_password", message: "known to be weak" },
    });
    const res = await cambiarContrasena(
      peticion({ currentPassword: "actual12", newPassword: "password123" }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("política de seguridad"),
    });
  });

  it("al borrar un usuario, donde la fuga estaba a tres líneas de su hermana buena", async () => {
    deleteUser.mockResolvedValue({
      error: { message: "GoTrue: user 4f2a-secret not deletable, constraint auth_x" },
    });
    const res = await borrarUsuario(new Request("http://localhost/x"), ctx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("No se pudo eliminar el usuario");
    expect(JSON.stringify(body)).not.toMatch(/GoTrue|constraint|4f2a/);
  });
});
