import { describe, it, expect } from "vitest";
import { canApprove, canEditRoster, canManageUsers } from "@/lib/auth/session";
import type { SessionUser, UserRole } from "@/lib/types";

/**
 * NOTE ON ROLES: the task brief referenced roles `super_admin`,
 * `delegado_jueces`, `delegado_zona`, `solo_ver`, and helpers
 * `canManageJudges` / `canAdminJudges`. The actual codebase
 * (src/lib/types.ts -> UserRole, src/lib/auth/session.ts) uses the role
 * triplet `nacional` | `regional` | `lectura` and exports only
 * `canEditRoster`, `canApprove`, `canManageUsers`. These tests cover the
 * RBAC helpers that genuinely exist; the brief's names do not appear in
 * the source.
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
  it("denies read-only (lectura) users", () => {
    expect(canEditRoster(user("lectura"), "Centro")).toBe(false);
  });

  it("allows national (nacional) users for any zone", () => {
    expect(canEditRoster(user("nacional"), "Centro")).toBe(true);
    expect(canEditRoster(user("nacional"), "Norte")).toBe(true);
    expect(canEditRoster(user("nacional"))).toBe(true);
  });

  it("allows regional users only within their own zone", () => {
    const regional = user("regional", "Centro");
    expect(canEditRoster(regional, "Centro")).toBe(true);
    expect(canEditRoster(regional, "Norte")).toBe(false);
  });

  it("denies a regional user when the event has no zone", () => {
    expect(canEditRoster(user("regional", "Centro"), undefined)).toBe(false);
  });
});

describe("canApprove", () => {
  it("allows only national users", () => {
    expect(canApprove(user("nacional"))).toBe(true);
    expect(canApprove(user("regional", "Centro"))).toBe(false);
    expect(canApprove(user("lectura"))).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("allows only national users", () => {
    expect(canManageUsers(user("nacional"))).toBe(true);
    expect(canManageUsers(user("regional", "Centro"))).toBe(false);
    expect(canManageUsers(user("lectura"))).toBe(false);
  });
});
