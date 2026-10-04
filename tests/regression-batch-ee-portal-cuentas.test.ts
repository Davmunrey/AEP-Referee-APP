import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysIso, todayIso } from "@/lib/business-date";
import { buildPortalDesignations } from "@/lib/judge-portal";
import { USER_ROLES, type Competition, type Referee, type RosterSession, type SessionUser } from "@/lib/types";

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const { getStore } = await import("@/server/store");
const { inviteJudges, revokeJudgeAccess, getJudgeAccessStatuses, requestJudgeAccess } = await import(
  "@/server/services/judge-accounts"
);
const { canAdministerUserWithRole, restrictedRoleMessage } = await import("@/lib/auth/session");

function juez(patch: Partial<Referee>): Referee {
  return {
    id: "x",
    nombre: "Juez Prueba",
    zona: "CENTRO",
    nivel: "Regional",
    estado: "Activo",
    eventos: 0,
    ultimo: "",
    disp: true,
    iniciales: "JP",
    ...patch,
  };
}

describe("cuentas de juez (memoria)", () => {
  beforeEach(() => {
    const store = getStore();
    store.referees = store.referees.filter((r) => !r.id.startsWith("pt-"));
    store.referees.push(
      juez({ id: "pt-1", email: "uno@aep.test" }),
      juez({ id: "pt-2" }),
      juez({ id: "pt-3", email: "Doble@aep.test" }),
      juez({ id: "pt-4", email: "doble@aep.test" }),
    );
  });

  const ficha = (id: string) => getStore().referees.find((r) => r.id === id)!;

  it("invitar enlaza la ficha; volver a invitar reenvía el enlace; sin e-mail no se puede", async () => {
    const [a, b] = await inviteJudges([ficha("pt-1"), ficha("pt-2")], "http://x/");
    expect(a!.outcome).toBe("invitado");
    expect(b!.outcome).toBe("sin-email");
    expect(ficha("pt-1").userId).toBeTruthy();
    expect((await inviteJudges([ficha("pt-1")], "http://x/"))[0]!.outcome).toBe("enlace-reenviado");
  });

  it("retirar el acceso se refleja en el estado y se puede devolver", async () => {
    await inviteJudges([ficha("pt-1")], "http://x/");
    expect(await revokeJudgeAccess(ficha("pt-1"))).toBe(true);
    expect((await getJudgeAccessStatuses([ficha("pt-1")]))["pt-1"]).toBe("revocado");
    expect((await inviteJudges([ficha("pt-1")], "http://x/"))[0]!.outcome).toBe("reactivado");
    expect((await getJudgeAccessStatuses([ficha("pt-1")]))["pt-1"]).toBe("con-acceso");
  });

  it("la petición del propio juez solo actúa con el e-mail exacto de UNA ficha", async () => {
    await requestJudgeAccess("nadie@aep.test", "http://x/");
    await requestJudgeAccess("DOBLE@aep.test", "http://x/");
    expect(ficha("pt-3").userId).toBeUndefined();
    expect(ficha("pt-4").userId).toBeUndefined();
    await requestJudgeAccess("  UNO@aep.test ", "http://x/");
    expect(ficha("pt-1").userId).toBeTruthy();
  });

  it("con el acceso retirado, pedirlo uno mismo no lo reactiva", async () => {
    await inviteJudges([ficha("pt-1")], "http://x/");
    await revokeJudgeAccess(ficha("pt-1"));
    await requestJudgeAccess("uno@aep.test", "http://x/");
    expect((await getJudgeAccessStatuses([ficha("pt-1")]))["pt-1"]).toBe("revocado");
  });
});

describe("las cuentas de juez no se gestionan desde «Usuarios»", () => {
  const admin = { id: "a", email: "a@b", nombre: "A", rol: "", iniciales: "A", role: "super_admin" } as SessionUser;
  it("no es un rol asignable y no se puede administrar desde ahí", () => {
    expect(USER_ROLES).not.toContain("juez");
    expect(canAdministerUserWithRole(admin, "juez")).toBe(false);
    expect(restrictedRoleMessage("juez")).toMatch(/ficha del juez/);
  });
});

describe("designaciones del portal", () => {
  const template: RosterSession[] = [
    { sesion: "S1", nombre: "Sesión 1", dia: "Sábado 24", categorias: [], horarioCompeticion: "10:00", horarioPesaje: "8:00", roles: [{ rol: "Central", key: "central", slots: 1 }], pesajeRoles: [{ rol: "Pesaje", key: "pesaje", slots: 1 }] },
    { sesion: "S2", nombre: "Sesión 2", dia: "Sábado 24", categorias: [], horarioCompeticion: "16:00", horarioPesaje: "14:00", roles: [{ rol: "Lateral", key: "lateral", slots: 2 }], pesajeRoles: [] },
  ];
  const base = { tipo: "AEP-3", sede: "Madrid", sesiones: 2, requeridos: 4, confirmados: 0, estado: "Borrador", zona: "CENTRO" } as const;
  const futura = addDaysIso(todayIso(), 20);
  const pasada = addDaysIso(todayIso(), -20);
  const comps: Competition[] = [
    { ...base, id: "aprobada", nombre: "Aprobada", fecha: futura, fechaFin: futura, aprobacion: "Aprobado" },
    { ...base, id: "borrador", nombre: "Borrador", fecha: futura, fechaFin: futura, aprobacion: "Sin propuesta" },
    { ...base, id: "pasada", nombre: "Pasada", fecha: pasada, fechaFin: pasada, aprobacion: "Sin propuesta" },
  ];
  const templates = new Map(comps.map((c) => [c.id, template]));
  const keys = new Map([
    ["aprobada", ["S2_lateral_1", "S1_central_0", "S1_pesaje_0"]],
    ["borrador", ["S1_central_0"]],
    ["pasada", ["S1_central_0"]],
  ]);

  it("una tarima sin aprobar no se enseña como designación", () => {
    const { upcoming, past } = buildPortalDesignations(comps, templates, keys);
    expect(upcoming.map((d) => d.competitionId)).toEqual(["aprobada"]);
    expect(past.map((d) => d.competitionId)).toEqual(["pasada"]);
  });

  it("agrupa por sesión, con día, horarios y funciones", () => {
    const [d] = buildPortalDesignations(comps, templates, keys).upcoming;
    expect(d!.sessions).toEqual([
      { session: "S1", nombre: "Sesión 1", dia: "Sábado 24", horarioCompeticion: "10:00", horarioPesaje: "8:00", roles: ["Juez Central", "Pesaje"].sort((a, b) => a.localeCompare(b, "es")) },
      { session: "S2", nombre: "Sesión 2", dia: "Sábado 24", horarioCompeticion: "16:00", horarioPesaje: "14:00", roles: ["Juez Lateral"] },
    ]);
  });
});

// ── Ruta de invitación: el delegado de zona solo invita a los de su zona ──
const requireApiUser = vi.fn();
const getRefereesByIds = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({ dataService: { getRefereesByIds: (...a: unknown[]) => getRefereesByIds(...a) } }));

describe("POST /referees/portal-access", () => {
  it("un delegado de zona no invita a nadie si la lista lleva jueces de otra zona", async () => {
    const { POST } = await import("@/app/api/v1/referees/portal-access/route");
    requireApiUser.mockResolvedValue({ id: "d", nombre: "D", email: "d@b", rol: "", iniciales: "D", role: "delegado_zona", zona: "CENTRO" });
    getRefereesByIds.mockResolvedValue(
      new Map([
        ["a", juez({ id: "a", zona: "CENTRO", email: "a@aep.test" })],
        ["b", juez({ id: "b", zona: "NORTE", email: "b@aep.test" })],
      ]),
    );
    const res = await POST(new Request("http://x/api/v1/referees/portal-access", { method: "POST", body: JSON.stringify({ refereeIds: ["a", "b"] }) }));
    expect(res.status).toBe(403);
  });

  it("solo_ver no invita", async () => {
    const { POST } = await import("@/app/api/v1/referees/portal-access/route");
    requireApiUser.mockResolvedValue({ id: "s", nombre: "S", email: "s@b", rol: "", iniciales: "S", role: "solo_ver" });
    const res = await POST(new Request("http://x/", { method: "POST", body: JSON.stringify({ refereeIds: ["a"] }) }));
    expect(res.status).toBe(403);
  });
});
