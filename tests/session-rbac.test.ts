import { describe, it, expect } from "vitest";
import {
  canAdminJudges,
  canApprove,
  canEditRoster,
  canManageCompensation,
  canManageJudges,
  canManageUsers,
} from "@/lib/auth/session";
import { canCreateCompetition } from "@/lib/permissions";
import { USER_ROLES, type SessionUser, type UserRole } from "@/lib/types";

/**
 * RBAC para el modelo de 5 roles:
 *  super_admin · delegado_jueces · delegado_zona · responsable_financiero_jueces · solo_ver
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
    expect(canEditRoster(user("super_admin"), "CENTRO")).toBe(true);
    expect(canEditRoster(user("super_admin"), "NOROESTE")).toBe(true);
    expect(canEditRoster(user("super_admin"))).toBe(true);
  });

  it("delegado_zona solo edita su propia zona", () => {
    const zona = user("delegado_zona", "CENTRO");
    expect(canEditRoster(zona, "CENTRO")).toBe(true);
    expect(canEditRoster(zona, "NOROESTE")).toBe(false);
    expect(canEditRoster(zona, undefined)).toBe(false);
  });

  it("delegado_zona alinea legacy VAL con competición MEDITERRANEO", () => {
    const delegado = user("delegado_zona", "VAL");
    expect(canEditRoster(delegado, "MEDITERRANEO")).toBe(true);
    expect(canEditRoster(delegado, "CENTRO")).toBe(false);
  });

  it("delegado_jueces edita tarima en cualquier zona (jefe nacional)", () => {
    expect(canEditRoster(user("delegado_jueces"), "CENTRO")).toBe(true);
    expect(canEditRoster(user("delegado_jueces"), "NOROESTE")).toBe(true);
    expect(canEditRoster(user("delegado_jueces"))).toBe(true);
  });

  it("solo_ver nunca edita", () => {
    expect(canEditRoster(user("solo_ver"), "CENTRO")).toBe(false);
  });

  it("responsable_financiero_jueces no edita tarima", () => {
    expect(canEditRoster(user("responsable_financiero_jueces"), "CENTRO")).toBe(false);
    expect(canEditRoster(user("responsable_financiero_jueces"), "NOROESTE")).toBe(false);
  });
});

describe("canApprove", () => {
  it("super_admin y delegado_jueces aprueban propuestas", () => {
    expect(canApprove(user("super_admin"))).toBe(true);
    expect(canApprove(user("delegado_jueces"))).toBe(true);
    expect(canApprove(user("delegado_zona", "CENTRO"))).toBe(false);
    expect(canApprove(user("solo_ver"))).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("super_admin y delegado_jueces gestionan usuarios", () => {
    expect(canManageUsers(user("super_admin"))).toBe(true);
    expect(canManageUsers(user("delegado_jueces"))).toBe(true);
    expect(canManageUsers(user("delegado_zona", "CENTRO"))).toBe(false);
    expect(canManageUsers(user("solo_ver"))).toBe(false);
  });
});

describe("canManageJudges", () => {
  it("super_admin, delegado_jueces y delegado_zona pueden crear/editar jueces", () => {
    expect(canManageJudges(user("super_admin"))).toBe(true);
    expect(canManageJudges(user("delegado_jueces"))).toBe(true);
    expect(canManageJudges(user("delegado_zona", "CENTRO"))).toBe(true);
    expect(canManageJudges(user("responsable_financiero_jueces"))).toBe(false);
    expect(canManageJudges(user("solo_ver"))).toBe(false);
  });
});

describe("canAdminJudges", () => {
  it("solo super_admin y delegado_jueces administran/eliminan jueces", () => {
    expect(canAdminJudges(user("super_admin"))).toBe(true);
    expect(canAdminJudges(user("delegado_jueces"))).toBe(true);
    expect(canAdminJudges(user("delegado_zona", "CENTRO"))).toBe(false);
    expect(canAdminJudges(user("responsable_financiero_jueces"))).toBe(false);
    expect(canAdminJudges(user("solo_ver"))).toBe(false);
  });
});

describe("canManageCompensation", () => {
  it("solo responsable financiero y super_admin gestionan compensación", () => {
    expect(canManageCompensation(user("responsable_financiero_jueces"))).toBe(true);
    expect(canManageCompensation(user("super_admin"))).toBe(true);
    expect(canManageCompensation(user("delegado_jueces"))).toBe(false);
    expect(canManageCompensation(user("delegado_zona", "CENTRO"))).toBe(false);
    expect(canManageCompensation(user("solo_ver"))).toBe(false);
  });
});

describe("canCreateCompetition", () => {
  it("crear/gestionar campeonatos excluye al financiero y a solo_ver", () => {
    expect(canCreateCompetition("super_admin")).toBe(true);
    expect(canCreateCompetition("delegado_jueces")).toBe(true);
    expect(canCreateCompetition("delegado_zona")).toBe(true);
    // El rol financiero NO gestiona tarima (solo compensación).
    expect(canCreateCompetition("responsable_financiero_jueces")).toBe(false);
    expect(canCreateCompetition("solo_ver")).toBe(false);
  });
});

describe("USER_ROLES", () => {
  it("es la fuente única de roles asignables (create y edit comparten lista)", () => {
    expect([...USER_ROLES].sort()).toEqual(
      [
        "delegado_jueces",
        "delegado_zona",
        "responsable_financiero_jueces",
        "solo_ver",
        "super_admin",
      ].sort(),
    );
  });
});
