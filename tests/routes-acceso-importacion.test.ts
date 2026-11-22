import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { SessionUser } from "@/lib/types";
import { campeonato, ctx, peticion, sinSesion, usuarios } from "./helpers/route-harness";

// Rutas públicas del acceso de jueces, cierre de sesión e importaciones de
// ficheros: quién puede, qué formatos y tamaños se aceptan, y que las públicas
// no delatan si un e-mail es de un juez.

const { auth, ds, cuentas, signOut, exportaciones } = vi.hoisted(() => {
  type Store = Record<string, Mock<(...a: unknown[]) => Promise<unknown>>>;
  return {
    auth: { user: null as unknown },
    ds: {} as Store,
    cuentas: {} as Store,
    signOut: vi.fn(async () => ({ error: null })),
    exportaciones: (store: Store, nombres: string[]) =>
      Object.fromEntries(
        nombres.map((n) => [n, (...a: unknown[]) => (store[n] ??= vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => undefined))(...a)]),
      ),
  };
});

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: async () => auth.user,
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: new Proxy({}, { get: (_t, k: string) => (ds[k] ??= vi.fn(async () => undefined)) }),
}));
vi.mock("@/server/services/judge-accounts", () =>
  exportaciones(cuentas, ["requestJudgeAccess", "redeemAccessCode"]),
);
// Sin base en las pruebas: el límite compartido no aporta datos y decide la memoria.
vi.mock("@/lib/api/shared-rate-limit", () => ({
  sharedPeek: async () => 0,
  sharedHit: async () => 0,
  sharedClear: async () => {},
}));
// Lo que se hace «después de responder» se ejecuta al momento para poder verlo.
vi.mock("@/lib/after-response", () => ({ afterResponse: (f: () => unknown) => void f() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const fn = (store: Record<string, Mock<(...a: unknown[]) => Promise<unknown>>>, name: string) =>
  (store[name] ??= vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => undefined));
const como = (u: SessionUser | Response) => {
  auth.user = u;
};

import { POST as judgeAccess } from "@/app/api/v1/auth/judge-access/route";
import { POST as judgeCode } from "@/app/api/v1/auth/judge-code/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import * as signoutRoute from "@/app/api/v1/auth/signout/route";
import { POST as importReferees } from "@/app/api/v1/referees/import/route";
import { POST as importCalendar } from "@/app/api/v1/calendar/import/route";
import { POST as importTemplate } from "@/app/api/v1/competitions/[id]/roster/template/import/route";
import { POST as importAssignments } from "@/app/api/v1/competitions/[id]/roster/assignments/import/route";
import { clearLoginAttempts } from "@/lib/api/login-rate-limit";
import { resetActionLimits } from "@/lib/api/action-rate-limit";

const conFichero = (file: File | null, url = "http://localhost/api") => {
  const fd = new FormData();
  if (file) fd.set("file", file);
  return new Request(url, { method: "POST", body: fd });
};
const pdf = (nombre = "cuadrante.pdf", bytes = "%PDF-1.4\n") => new File([bytes], nombre, { type: "application/pdf" });

beforeEach(() => {
  for (const s of [ds, cuentas]) for (const k of Object.keys(s)) delete s[k];
  resetActionLimits();
  clearLoginAttempts("unknown", "ana@aep.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  como(usuarios.admin);
  fn(ds, "getCompetition").mockResolvedValue(campeonato());
});

describe("un juez pide acceso", () => {
  it("e-mail no válido, 400", async () => {
    expect((await judgeAccess(peticion({ email: "a" }))).status).toBe(400);
    expect((await judgeAccess(peticion({ email: `${"a".repeat(260)}@x.es` }))).status).toBe(400);
  });

  it("responde lo mismo esté o no en el censo, y avisa después", async () => {
    const r1 = await judgeAccess(peticion({ email: "ana@aep.test" }));
    const r2 = await judgeAccess(peticion({ email: "nadie@aep.test" }));
    expect(r1.status).toBe(200);
    expect(await r1.text()).toBe(await r2.text());
    expect(fn(cuentas, "requestJudgeAccess")).toHaveBeenCalledWith("ana@aep.test");
  });

  it("frena el tanteo de e-mails desde la misma IP", async () => {
    let ultimo = 200;
    for (let i = 0; i < 21; i++) {
      ultimo = (await judgeAccess(peticion({ email: `juez${i}@aep.test` }))).status;
    }
    expect(ultimo).toBe(429);
  });
});

describe("un juez canjea su código", () => {
  const body = { email: "ana@aep.test", code: "ABCD-EFGH", password: "mi-clave-segura" };

  it("faltan datos, 400 sin tocar el servicio", async () => {
    expect((await judgeCode(peticion({ email: "ana@aep.test" }))).status).toBe(400);
    expect((await judgeCode(peticion({ ...body, code: "corto" }))).status).toBe(400);
    expect(fn(cuentas, "redeemAccessCode")).not.toHaveBeenCalled();
  });

  it("contraseña corta, código inválido y acierto", async () => {
    fn(cuentas, "redeemAccessCode").mockResolvedValueOnce("contrasena-corta");
    expect((await judgeCode(peticion(body))).status).toBe(400);
    fn(cuentas, "redeemAccessCode").mockResolvedValueOnce("invalido");
    const malo = await judgeCode(peticion(body));
    expect(malo.status).toBe(400);
    fn(cuentas, "redeemAccessCode").mockResolvedValueOnce("ok");
    expect((await judgeCode(peticion(body))).status).toBe(200);
  });

  it("tras 5 códigos fallidos para el mismo e-mail, 429", async () => {
    fn(cuentas, "redeemAccessCode").mockResolvedValue("invalido");
    for (let i = 0; i < 5; i++) await judgeCode(peticion(body));
    expect((await judgeCode(peticion(body))).status).toBe(429);
  });

  it("si el servicio falla, error con cuerpo JSON", async () => {
    fn(cuentas, "redeemAccessCode").mockRejectedValue(new Error("caída"));
    const res = await judgeCode(peticion(body));
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

describe("cerrar sesión", () => {
  it("logout cierra la sesión", async () => {
    signOut.mockClear();
    expect((await logout()).status).toBe(200);
    expect(signOut).toHaveBeenCalled();
  });

  it("signout solo por POST (por GET sería logout-CSRF) y redirige con 303", async () => {
    expect("GET" in signoutRoute).toBe(false);
    const res = await signoutRoute.POST(new Request("http://localhost/api/v1/auth/signout", { method: "POST" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/sign-in");
  });
});

describe("importar el registro de jueces", () => {
  it("solo super admin y delegado de jueces", async () => {
    for (const u of [usuarios.zona, usuarios.lectura, usuarios.financiero]) {
      como(u);
      expect((await importReferees(conFichero(null))).status).toBe(403);
    }
  });

  it("sin fichero, demasiado grande o que no es Excel: 400", async () => {
    expect((await importReferees(peticion({}))).status).toBe(400);
    expect((await importReferees(conFichero(null))).status).toBe(400);
    const grande = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "censo.xlsx");
    expect((await importReferees(conFichero(grande))).status).toBe(400);
    expect((await importReferees(conFichero(new File(["hola"], "censo.txt")))).status).toBe(400);
    expect(fn(ds, "importJudgesRegistry")).not.toHaveBeenCalled();
  });
});

describe("importar el calendario", () => {
  it("solo super admin y delegado de jueces", async () => {
    como(usuarios.zona);
    expect((await importCalendar(conFichero(pdf("calendario.pdf")))).status).toBe(403);
  });

  it("sin fichero o en otro formato: 400", async () => {
    expect((await importCalendar(conFichero(null))).status).toBe(400);
    const imagen = new File(["x"], "calendario.png", { type: "image/png" });
    expect((await importCalendar(conFichero(imagen))).status).toBe(400);
    expect(fn(ds, "createCompetition")).not.toHaveBeenCalled();
  });
});

describe("importar plantilla y asignaciones de la tarima", () => {
  const rutas: [string, (r: Request) => Promise<Response>][] = [
    ["plantilla", (r) => importTemplate(r, ctx({ id: "c1" }))],
    ["asignaciones", (r) => importAssignments(r, ctx({ id: "c1" }))],
  ];

  it.each(rutas)("%s: otra zona, solo lectura y tarima aprobada no pueden", async (_n, call) => {
    for (const u of [usuarios.otraZona, usuarios.lectura]) {
      como(u);
      expect((await call(conFichero(pdf()))).status).toBe(403);
    }
    como(usuarios.admin);
    fn(ds, "getCompetition").mockResolvedValue(campeonato({ aprobacion: "Aprobado" }));
    expect((await call(conFichero(pdf()))).status).toBe(423);
  });

  it.each(rutas)("%s: sin fichero o que no es PDF, 400", async (_n, call) => {
    expect((await call(conFichero(null))).status).toBe(400);
    const word = new File(["x"], "cuadrante.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect((await call(conFichero(word))).status).toBe(400);
    expect(fn(ds, "saveCompetitionTemplate")).not.toHaveBeenCalled();
    expect(fn(ds, "assignRefereesBatch")).not.toHaveBeenCalled();
  });

  it("sin sesión, 401", async () => {
    como(sinSesion());
    expect((await importTemplate(conFichero(pdf()), ctx({ id: "c1" }))).status).toBe(401);
  });
});
