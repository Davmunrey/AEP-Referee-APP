import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysIso, todayIso } from "@/lib/business-date";
import { buildPortalDesignations } from "@/lib/judge-portal";
import { USER_ROLES, type Competition, type Referee, type RosterSession, type SessionUser } from "@/lib/types";

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const { getStore } = await import("@/server/store");
const { issueAccessCodes, redeemAccessCode, revokeJudgeAccess, getJudgeAccessStatuses } = await import(
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

describe("cuentas de juez con código (memoria)", () => {
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
  const estado = async (id: string) => (await getJudgeAccessStatuses([ficha(id)])).statuses[id];

  it("dar acceso enlaza la ficha y deja un código pendiente; sin e-mail no se puede", async () => {
    const [a, b] = await issueAccessCodes([ficha("pt-1"), ficha("pt-2")]);
    expect(a!.outcome).toBe("codigo");
    expect(a!.code).toBeTruthy();
    expect(b!.outcome).toBe("sin-email");
    expect(ficha("pt-1").userId).toBeTruthy();
    expect(await estado("pt-1")).toBe("codigo-pendiente");
    expect(await redeemAccessCode("uno@aep.test", a!.code!, "clave-larga-1")).toBe("ok");
    expect(await estado("pt-1")).toBe("con-acceso");
  });

  it("retirar el acceso se refleja en el estado y se puede devolver con otro código", async () => {
    await issueAccessCodes([ficha("pt-1")]);
    expect(await revokeJudgeAccess(ficha("pt-1"))).toBe(true);
    expect(await estado("pt-1")).toBe("revocado");
    const [r] = await issueAccessCodes([ficha("pt-1")]);
    expect(r!.outcome).toBe("codigo");
    expect(await estado("pt-1")).toBe("codigo-pendiente");
  });

  it("dos fichas con el mismo e-mail: el código no entra en ninguna", async () => {
    const [r] = await issueAccessCodes([ficha("pt-3")]);
    expect(await redeemAccessCode("doble@aep.test", r!.code!, "clave-larga-1")).toBe("invalido");
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

// ── Ruta de acceso: el delegado de zona solo da acceso a los de su zona ──
const requireApiUser = vi.fn();
const getRefereesByIds = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({ dataService: { getRefereesByIds: (...a: unknown[]) => getRefereesByIds(...a) } }));

describe("POST /referees/portal-access", () => {
  it("un delegado de zona no da acceso a nadie si la lista lleva jueces de otra zona", async () => {
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

  it("solo_ver no da acceso", async () => {
    const { POST } = await import("@/app/api/v1/referees/portal-access/route");
    requireApiUser.mockResolvedValue({ id: "s", nombre: "S", email: "s@b", rol: "", iniciales: "S", role: "solo_ver" });
    const res = await POST(new Request("http://x/", { method: "POST", body: JSON.stringify({ refereeIds: ["a"] }) }));
    expect(res.status).toBe(403);
  });
});
