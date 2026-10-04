import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Referee } from "@/lib/types";

// Acceso de jueces con código contra Supabase (cliente de servicio simulado).
// La aplicación no envía correos: ninguna prueba debe ver un envío.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let created: { email: string; password: string }[];
let deletedUsers: string[];
let passwords: Record<string, string>;
let authEmails: Record<string, string>;
let avisos: Row[];
const KEY: Record<string, string> = { profiles: "id", judge_access_codes: "referee_id" };

function query(table: string) {
  const rows = () => (tables[table] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let del = false;
  const q: Record<string, unknown> = {};
  const run = () => {
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (patch) for (const r of hit) Object.assign(r, patch);
    if (del) tables[table] = rows().filter((r) => !hit.includes(r));
    return { data: hit, error: null };
  };
  q.select = () => q;
  q.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), q);
  q.is = (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q);
  q.in = (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q);
  q.ilike = (c: string, v: string) =>
    (filters.push((r) => String(r[c] ?? "").toLowerCase() === v.replace(/\\/g, "").toLowerCase()), q);
  q.limit = () => q;
  q.update = (p: Row) => ((patch = p), q);
  q.delete = () => ((del = true), q);
  q.upsert = async (row: Row) => {
    const key = KEY[table] ?? "id";
    tables[table] = rows().filter((r) => r[key] !== row[key]).concat([{ ...row }]);
    return { error: null };
  };
  q.maybeSingle = async () => ({ data: run().data[0] ?? null, error: null });
  q.then = (resolve: (r: unknown) => unknown) => Promise.resolve(run()).then(resolve);
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: query,
    auth: {
      admin: {
        createUser: async ({ email, password }: { email: string; password: string }) => {
          created.push({ email, password });
          const id = `u-${created.length}`;
          authEmails[id] = email;
          passwords[id] = password;
          return { data: { user: { id } }, error: null };
        },
        getUserById: async (id: string) => ({ data: { user: { id, email: authEmails[id] } }, error: null }),
        updateUserById: async (id: string, attrs: { email?: string; password?: string }) => {
          if (attrs.email) authEmails[id] = attrs.email;
          if (attrs.password) passwords[id] = attrs.password;
          return { data: { user: { id } }, error: null };
        },
        deleteUser: async (id: string) => {
          deletedUsers.push(id);
          return { error: null };
        },
        inviteUserByEmail: async () => {
          throw new Error("la aplicación no envía invitaciones por correo");
        },
      },
    },
  }),
}));
vi.mock("@/server/services", () => ({
  dataService: { insertNotificaciones: async (rows: Row[]) => void avisos.push(...rows) },
}));
vi.mock("@/server/destinatarios", () => ({
  delegadosDeZona: async (zona: string) => (zona === "CENTRO" ? ["delegado-centro"] : []),
  gestionNacional: async () => ["nacional"],
}));

const { issueAccessCodes, redeemAccessCode, requestJudgeAccess, revokeJudgeAccess, getJudgeAccessStatuses } =
  await import("@/server/services/judge-accounts");

const ficha = (patch: Partial<Referee> = {}): Referee => ({
  id: "j1", nombre: "Ana Roa", zona: "CENTRO", nivel: "Regional", estado: "Activo", eventos: 0, ultimo: "", disp: true, iniciales: "AR", email: "ana@aep.test", ...patch,
});

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.profiles = [];
  tables.referees = [{ id: "j1", email: "ana@aep.test", user_id: null, nombre: "Ana Roa", zona: "CENTRO", nivel: "Regional", estado: "Activo" }];
  created = [];
  deletedUsers = [];
  passwords = {};
  authEmails = {};
  avisos = [];
});

/** Lee la ficha actualizada (con su `user_id`) como la daría el servicio. */
const fichaActual = () => ficha({ userId: (tables.referees![0]!.user_id as string | null) ?? undefined });

describe("dar acceso (Supabase)", () => {
  it("crea la cuenta sin enviar nada, como juez activo, y devuelve un código", async () => {
    const [r] = await issueAccessCodes([ficha()]);
    expect(r!.outcome).toBe("codigo");
    expect(r!.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(created).toHaveLength(1);
    expect(created[0]!.email).toBe("ana@aep.test");
    // Contraseña aleatoria que nadie conoce: la de verdad la pone el juez.
    expect(created[0]!.password.length).toBeGreaterThanOrEqual(24);
    expect(tables.profiles![0]).toMatchObject({ role: "juez", activo: true, rol_label: "Juez" });
    expect(tables.referees![0]!.user_id).toBe("u-1");
    // Se guarda el resumen, nunca el código.
    const stored = tables.judge_access_codes![0]!;
    expect(stored.code_hash).not.toContain(r!.code!);
    expect(String(stored.code_hash)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("no toca una cuenta de gestión que ya use ese e-mail", async () => {
    tables.profiles = [{ id: "staff", email: "ana@aep.test", role: "delegado_zona", activo: true }];
    const [r] = await issueAccessCodes([ficha()]);
    expect(r!.outcome).toBe("email-en-uso");
    expect(r!.code).toBeUndefined();
    expect(created).toEqual([]);
  });

  it("con cuenta, un código nuevo sustituye al anterior sin crear otra cuenta", async () => {
    const [primero] = await issueAccessCodes([ficha()]);
    const [segundo] = await issueAccessCodes([fichaActual()]);
    expect(created).toHaveLength(1);
    expect(tables.judge_access_codes).toHaveLength(1);
    expect(await redeemAccessCode("ana@aep.test", primero!.code!, "nueva-clave-1")).toBe("invalido");
    expect(await redeemAccessCode("ana@aep.test", segundo!.code!, "nueva-clave-1")).toBe("ok");
  });

  it("si el e-mail del censo cambió, la cuenta pasa a entrar con el nuevo", async () => {
    tables.profiles = [{ id: "u-9", email: "vieja@club.test", role: "juez", activo: true }];
    tables.referees![0]!.user_id = "u-9";
    authEmails = { "u-9": "vieja@club.test" };
    await issueAccessCodes([ficha({ userId: "u-9" })]);
    expect(authEmails["u-9"]).toBe("ana@aep.test");
    expect(tables.profiles[0]!.email).toBe("ana@aep.test");
  });
});

describe("canjear el código (Supabase)", () => {
  it("pone la contraseña elegida y borra el código: no vale dos veces", async () => {
    const [r] = await issueAccessCodes([ficha()]);
    // Da igual cómo lo escriba: minúsculas, espacios o guion.
    const escrito = `${r!.code!.slice(0, 4).toLowerCase()} ${r!.code!.slice(4)}`;
    expect(await redeemAccessCode("ANA@aep.test", escrito, "mi-clave-segura")).toBe("ok");
    expect(passwords["u-1"]).toBe("mi-clave-segura");
    expect(tables.judge_access_codes).toEqual([]);
    expect(await redeemAccessCode("ana@aep.test", r!.code!, "otra-clave-123")).toBe("invalido");
    expect((await getJudgeAccessStatuses([fichaActual()])).statuses.j1).toBe("con-acceso");
  });

  it("con un código ajeno, caducado o un e-mail que no es el suyo, nada", async () => {
    const [r] = await issueAccessCodes([ficha()]);
    expect(await redeemAccessCode("otro@aep.test", r!.code!, "mi-clave-segura")).toBe("invalido");
    expect(await redeemAccessCode("ana@aep.test", "AAAAAAAA", "mi-clave-segura")).toBe("invalido");
    tables.judge_access_codes![0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await redeemAccessCode("ana@aep.test", r!.code!, "mi-clave-segura")).toBe("invalido");
    expect(passwords["u-1"]).not.toBe("mi-clave-segura");
  });

  it("tras varios intentos fallidos el código se anula aunque luego se acierte", async () => {
    const [r] = await issueAccessCodes([ficha()]);
    for (let i = 0; i < 5; i++) await redeemAccessCode("ana@aep.test", "BBBBBBBB", "mi-clave-segura");
    expect(tables.judge_access_codes).toEqual([]);
    expect(await redeemAccessCode("ana@aep.test", r!.code!, "mi-clave-segura")).toBe("invalido");
  });

  it("si le retiran el acceso, su código pendiente deja de valer", async () => {
    const [r] = await issueAccessCodes([ficha()]);
    expect(await revokeJudgeAccess(fichaActual())).toBe(true);
    expect(await redeemAccessCode("ana@aep.test", r!.code!, "mi-clave-segura")).toBe("invalido");
  });

  it("una contraseña corta se rechaza sin gastar el código", async () => {
    const [r] = await issueAccessCodes([ficha()]);
    expect(await redeemAccessCode("ana@aep.test", r!.code!, "corta")).toBe("contrasena-corta");
    expect(await redeemAccessCode("ana@aep.test", r!.code!, "ahora-si-larga")).toBe("ok");
  });
});

describe("el juez pide acceso (Supabase)", () => {
  it("con un e-mail que no está en el censo no avisa a nadie", async () => {
    await requestJudgeAccess("otro@aep.test");
    expect(avisos).toEqual([]);
    expect(created).toEqual([]);
  });

  it("con el e-mail de su ficha avisa a su delegado de zona, sin crear cuenta ni enviar nada", async () => {
    await requestJudgeAccess("ANA@aep.test");
    expect(created).toEqual([]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ userId: "delegado-centro", tipo: "acceso-solicitado", href: "/referees/j1" });
  });

  it("sin delegado en su zona, el aviso va a la gestión nacional", async () => {
    tables.referees![0]!.zona = "CANARIAS";
    await requestJudgeAccess("ana@aep.test");
    expect(avisos[0]).toMatchObject({ userId: "nacional" });
  });
});

describe("la aplicación no envía correos", () => {
  it("ningún código llama a los envíos de Supabase Auth", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
      });
    const offenders = walk("src").filter((p) =>
      /inviteUserByEmail|signInWithOtp|resetPasswordForEmail|generateLink\(/.test(readFileSync(p, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
