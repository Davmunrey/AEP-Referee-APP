import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Referee } from "@/lib/types";

// Invitación de jueces contra Supabase (cliente de servicio simulado).

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

type Row = Record<string, unknown>;
let profiles: Row[];
let referees: Row[];
let invited: string[];
let deletedUsers: string[];
let magicLinks: string[];

function query(table: string) {
  const rows = () => (table === "profiles" ? profiles : referees);
  let filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let del = false;
  const q: Record<string, unknown> = {};
  const run = () => {
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (patch) for (const r of hit) Object.assign(r, patch);
    if (del) {
      const keep = rows().filter((r) => !hit.includes(r));
      if (table === "profiles") profiles = keep;
      else referees = keep;
    }
    return { data: hit, error: null };
  };
  q.select = () => q;
  q.eq = (c: string, v: unknown) => ((filters.push((r) => r[c] === v)), q);
  q.is = (c: string, v: unknown) => ((filters.push((r) => (r[c] ?? null) === v)), q);
  q.in = (c: string, v: unknown[]) => ((filters.push((r) => v.includes(r[c]))), q);
  q.ilike = (c: string, v: string) => ((filters.push((r) => String(r[c] ?? "").toLowerCase() === v.replace(/\\/g, "").toLowerCase())), q);
  q.limit = () => q;
  q.update = (p: Row) => ((patch = p), q);
  q.delete = () => ((del = true), q);
  q.upsert = async (row: Row) => {
    profiles = profiles.filter((p) => p.id !== row.id).concat([{ ...row }]);
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
        inviteUserByEmail: async (email: string) => {
          invited.push(email);
          return { data: { user: { id: `u-${invited.length}` } }, error: null };
        },
        deleteUser: async (id: string) => {
          deletedUsers.push(id);
          return { error: null };
        },
      },
    },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: async ({ email }: { email: string }) => {
        magicLinks.push(email);
        return { error: null };
      },
    },
  }),
}));

const { inviteJudges, requestJudgeAccess } = await import("@/server/services/judge-accounts");

const ficha = (patch: Partial<Referee>): Referee => ({
  id: "j1", nombre: "Ana Roa", zona: "CENTRO", nivel: "Regional", estado: "Activo", eventos: 0, ultimo: "", disp: true, iniciales: "AR", ...patch,
});

beforeEach(() => {
  profiles = [];
  referees = [{ id: "j1", email: "ana@aep.test", user_id: null, nombre: "Ana Roa", zona: "CENTRO", nivel: "Regional", estado: "Activo" }];
  invited = [];
  deletedUsers = [];
  magicLinks = [];
});

describe("invitar jueces (Supabase)", () => {
  it("crea la cuenta como juez activo y la enlaza a la ficha", async () => {
    const [r] = await inviteJudges([ficha({ email: "ana@aep.test" })], "http://x/");
    expect(r!.outcome).toBe("invitado");
    expect(invited).toEqual(["ana@aep.test"]);
    expect(profiles[0]).toMatchObject({ role: "juez", activo: true, rol_label: "Juez" });
    expect(referees[0]!.user_id).toBe("u-1");
  });

  it("no toca una cuenta de gestión que ya use ese e-mail", async () => {
    profiles = [{ id: "staff", email: "ana@aep.test", role: "delegado_zona", activo: true }];
    const [r] = await inviteJudges([ficha({ email: "ana@aep.test" })], "http://x/");
    expect(r!.outcome).toBe("email-en-uso");
    expect(invited).toEqual([]);
    expect(profiles[0]!.role).toBe("delegado_zona");
  });

  it("si otro delegado lo enlazó a la vez, borra la cuenta sobrante", async () => {
    referees[0]!.user_id = "otro";
    const [r] = await inviteJudges([ficha({ email: "ana@aep.test" })], "http://x/");
    expect(r!.outcome).toBe("enlace-reenviado");
    expect(deletedUsers).toEqual(["u-1"]);
    expect(referees[0]!.user_id).toBe("otro");
  });

  it("con cuenta activa, reenvía el enlace en vez de crear otra", async () => {
    profiles = [{ id: "u-9", email: "ana@aep.test", role: "juez", activo: true }];
    const [r] = await inviteJudges([ficha({ email: "ana@aep.test", userId: "u-9" })], "http://x/");
    expect(r!.outcome).toBe("enlace-reenviado");
    expect(magicLinks).toEqual(["ana@aep.test"]);
    expect(invited).toEqual([]);
  });
});

describe("el juez pide acceso (Supabase)", () => {
  it("con un e-mail que no está en el censo no envía nada", async () => {
    await requestJudgeAccess("otro@aep.test", "http://x/");
    expect(invited).toEqual([]);
    expect(magicLinks).toEqual([]);
  });

  it("con el e-mail de su ficha (sin distinguir mayúsculas) recibe la invitación", async () => {
    await requestJudgeAccess("ANA@aep.test", "http://x/");
    expect(invited).toEqual(["ana@aep.test"]);
  });
});
