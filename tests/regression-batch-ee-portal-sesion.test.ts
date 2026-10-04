import { beforeEach, describe, expect, it, vi } from "vitest";

// Portal del juez: el rol `juez` NO tiene sesión de gestión. La puerta está en
// `getSession` (que usan las páginas del panel y `requireApiUser`), así que
// ninguna página ni ruta de la gestión tiene que acordarse de excluirlo.
//
// Se prueba con el modo captura (sin Supabase), que puede presentarse como
// juez con una cookie.

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.AEP_DOCS_CAPTURE = "1";

let rolCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "aep-captura-rol" && rolCookie ? { value: rolCookie } : undefined),
  }),
}));

const { getSession, getJudgeSession } = await import("@/lib/auth/session");
const { requireApiUser, requireJudgeUser, isSessionUser } = await import("@/lib/api/auth");

beforeEach(() => {
  rolCookie = undefined;
});

describe("sesión de juez", () => {
  it("un juez no tiene sesión de gestión, pero sí de portal", async () => {
    rolCookie = "juez";
    expect(await getSession()).toBeNull();
    const judge = await getJudgeSession();
    expect(judge).toMatchObject({ role: "juez", refereeId: "j001" });
  });

  it("la API de gestión le responde 403, no 401 (que su navegador leería como «sesión caducada»)", async () => {
    rolCookie = "juez";
    const res = await requireApiUser();
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it("la API del portal le deja pasar con su ficha", async () => {
    rolCookie = "juez";
    const res = await requireJudgeUser();
    expect(isSessionUser(res as never)).toBe(true);
    expect(res).toMatchObject({ refereeId: "j001" });
  });

  it("el personal de gestión no entra a la API del portal", async () => {
    expect(await getSession()).toMatchObject({ role: "super_admin" });
    expect(await getJudgeSession()).toBeNull();
    const res = await requireJudgeUser();
    expect((res as Response).status).toBe(401);
  });
});
