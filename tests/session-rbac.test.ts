import { describe, it, expect } from "vitest";
import {
  canAdminJudges,
  canApprove,
  canEditRoster,
  canManageJudges,
  canManageUsers,
} from "@/lib/auth/session";
import type { SessionUser, UserRole } from "@/lib/types";

/**
 * RBAC para el modelo de 4 roles:
 *  super_admin · delegado_jueces · delegado_zona · solo_ver
 */
function user(role: UserRole, zona?: string): SessionUser {
  return {
    id: "u1",
    nombre: "Usuario",
    rol: "Rol",
    iniciales: "US",
    email: "user@example.com",
    role,
    zona,
  };
}

describe("canEditRoster", () => {
  it("super_admin puede editar cualquier zona", () => {
    expect(canEditRoster(user("super_admin"), "Centro")).toBe(true);
    expect(canEditRoster(user("super_admin"), "Norte")).toBe(true);
    expect(canEditRoster(user("super_admin"))).toBe(true);
  });

  it("delegado_zona solo edita su propia zona", () => {
    const zona = user("delegado_zona", "Centro");
    expect(canEditRoster(zona, "Centro")).toBe(true);
    expect(canEditRoster(zona, "Norte")).toBe(false);
    expect(canEditRoster(zona, undefined)).toBe(false);
  });

  it("delegado_jueces edita tarima en cualquier zona (jefe nacional)", () => {
    expect(canEditRoster(user("delegado_jueces"), "Centro")).toBe(true);
    expect(canEditRoster(user("delegado_jueces"), "Norte")).toBe(true);
    expect(canEditRoster(user("delegado_jueces"))).toBe(true);
  });

  it("solo_ver nunca edita", () => {
    expect(canEditRoster(user("solo_ver"), "Centro")).toBe(false);
  });
});

describe("canApprove", () => {
  it("super_admin y delegado_jueces aprueban propuestas", () => {
    expect(canApprove(user("super_admin"))).toBe(true);
    expect(canApprove(user("delegado_jueces"))).toBe(true);
    expect(canApprove(user("delegado_zona", "Centro"))).toBe(false);
    expect(canApprove(user("solo_ver"))).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("super_admin y delegado_jueces gestionan usuarios", () => {
    expect(canManageUsers(user("super_admin"))).toBe(true);
    expect(canManageUsers(user("delegado_jueces"))).toBe(true);
    expect(canManageUsers(user("delegado_zona", "Centro"))).toBe(false);
    expect(canManageUsers(user("solo_ver"))).toBe(false);
  });
});

describe("canManageJudges", () => {
  it("todos menos solo_ver pueden crear/editar jueces", () => {
    expect(canManageJudges(user("super_admin"))).toBe(true);
    expect(canManageJudges(user("delegado_jueces"))).toBe(true);
    expect(canManageJudges(user("delegado_zona", "Centro"))).toBe(true);
    expect(canManageJudges(user("solo_ver"))).toBe(false);
  });
});

describe("canAdminJudges", () => {
  it("solo super_admin y delegado_jueces administran/eliminan jueces", () => {
    expect(canAdminJudges(user("super_admin"))).toBe(true);
    expect(canAdminJudges(user("delegado_jueces"))).toBe(true);
    expect(canAdminJudges(user("delegado_zona", "Centro"))).toBe(false);
    expect(canAdminJudges(user("solo_ver"))).toBe(false);
  });
});
