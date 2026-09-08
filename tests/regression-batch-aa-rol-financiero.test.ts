import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUPER_ADMIN_ONLY_ROLES } from "@/lib/types";
import {
  canAdministerUserWithRole,
  canAssignRole,
  restrictedRoleMessage,
} from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";

const user = (role: SessionUser["role"]): SessionUser => ({
  id: `u-${role}`,
  nombre: role,
  rol: role,
  iniciales: "XX",
  email: `${role}@example.org`,
  role,
});

describe("quién puede gestionar la cuenta que ve el dinero", () => {
  it("el responsable financiero está protegido como el super admin", () => {
    expect([...SUPER_ADMIN_ONLY_ROLES].sort()).toEqual(
      ["responsable_financiero_jueces", "super_admin"].sort(),
    );
  });

  it("un delegado de jueces no puede asignar ninguno de los dos", () => {
    const delegado = user("delegado_jueces");
    expect(canAssignRole(delegado, "responsable_financiero_jueces")).toBe(false);
    expect(canAssignRole(delegado, "super_admin")).toBe(false);
    // Los demás roles siguen siendo suyos: no se le quita la gestión de cuentas.
    expect(canAssignRole(delegado, "delegado_zona")).toBe(true);
    expect(canAssignRole(delegado, "solo_ver")).toBe(true);
    expect(canAssignRole(delegado, "delegado_jueces")).toBe(true);
  });

  it("tampoco puede tocar una cuenta que ya tiene el rol", () => {
    const delegado = user("delegado_jueces");
    expect(canAdministerUserWithRole(delegado, "responsable_financiero_jueces")).toBe(false);
    expect(canAdministerUserWithRole(delegado, "delegado_zona")).toBe(true);
  });

  it("el super admin sí, y quien no gestiona cuentas no puede nada", () => {
    const admin = user("super_admin");
    expect(canAssignRole(admin, "responsable_financiero_jueces")).toBe(true);
    expect(canAdministerUserWithRole(admin, "super_admin")).toBe(true);
    const zona = user("delegado_zona");
    expect(canAssignRole(zona, "solo_ver")).toBe(false);
    expect(canAdministerUserWithRole(zona, "solo_ver")).toBe(false);
  });

  it("el mensaje nombra el rol en legible", () => {
    expect(restrictedRoleMessage("responsable_financiero_jueces")).toContain(
      "Responsable Financiero Jueces",
    );
  });
});

// ── Rutas ───────────────────────────────────────────────────────────────────
const requireApiUser = vi.fn();
const updateUserById = vi.fn();
const createUser = vi.fn();
const inserted: { table: string; row: Record<string, unknown> }[] = [];

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: mockTarget, error: null }),
        single: async () => ({ data: { ...mockTarget, nombre: "Objetivo" }, error: null }),
        update: () => q,
        upsert: async () => ({ error: null }),
        insert: (row: Record<string, unknown>) => {
          inserted.push({ table, row });
          return q;
        },
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve({ data: { ...mockTarget, nombre: "Objetivo" }, error: null }).then(resolve),
      };
      return q;
    },
    auth: { admin: { updateUserById, createUser, deleteUser: async () => ({ error: null }) } },
  }),
}));

import { POST as createUserRoute } from "@/app/api/v1/admin/users/route";
import { PATCH } from "@/app/api/v1/admin/users/[id]/route";
import { POST as resetPassword } from "@/app/api/v1/admin/users/[id]/password/route";

let mockTarget: Record<string, unknown> | null = { id: "t1", role: "delegado_zona" };
const ctx = { params: Promise.resolve({ id: "t1" }) };
const delegadoJueces = { id: "u1", role: "delegado_jueces", nombre: "Delegado" };

function json(url: string, payload: unknown) {
  return new Request(url, { method: "POST", body: JSON.stringify(payload) });
}

beforeEach(() => {
  requireApiUser.mockReset();
  updateUserById.mockReset();
  createUser.mockReset();
  inserted.length = 0;
  updateUserById.mockResolvedValue({ error: null });
  createUser.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
  mockTarget = { id: "t1", role: "delegado_zona" };
  requireApiUser.mockResolvedValue(delegadoJueces);
});

describe("los tres caminos hacia el rol financiero", () => {
  it("1) crear la cuenta financiera directamente: 403", async () => {
    const res = await createUserRoute(
      json("http://localhost/x", {
        email: "tesorero@aep.es",
        password: "unaclave8",
        nombre: "Tesorero",
        rolLabel: "Tesorero",
        role: "responsable_financiero_jueces",
      }),
    );
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("2) ascender a financiera una cuenta existente: 403", async () => {
    const res = await PATCH(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ role: "responsable_financiero_jueces" }),
      }),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("3) resetear la contraseña de quien ya lo es: 403", async () => {
    mockTarget = { id: "t1", role: "responsable_financiero_jueces" };
    const res = await resetPassword(json("http://localhost/x", { password: "unaclave8" }), ctx);
    expect(res.status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("el super admin sí puede resetearla, y queda registrado", async () => {
    requireApiUser.mockResolvedValue({ id: "u0", role: "super_admin", nombre: "Jefa" });
    mockTarget = { id: "t1", role: "responsable_financiero_jueces", nombre: "Tesorero" };
    const res = await resetPassword(json("http://localhost/x", { password: "unaclave8" }), ctx);
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalled();
    // Antes ninguno de estos cambios de acceso dejaba rastro.
    const entry = inserted.find((i) => i.table === "activity_log");
    expect(entry?.row.accion).toBe("restableció la contraseña de");
    expect(entry?.row.actor).toBe("Jefa");
  });

  it("un delegado de jueces sigue pudiendo con los roles no restringidos", async () => {
    const res = await PATCH(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ role: "solo_ver" }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
  });
});
