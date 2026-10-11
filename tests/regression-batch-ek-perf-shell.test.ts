import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Rendimiento del armazón (middleware, sesión, campana, tiempo real):
//  - el middleware verifica el token con `getClaims()` y no con `getUser()`;
//  - el portal lee la ficha del juez embebida en la lectura del perfil, sin un
//    tercer viaje en serie;
//  - abrir la campana ya no repinta la página entera;
//  - el refresco propio tras guardar y el eco en tiempo real de ese mismo
//    guardado se funden en un único refresco;
//  - el portal tiene límite de carga y el panel no carga supabase-js de golpe.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
delete process.env.AEP_DOCS_CAPTURE;

const leer = (p: string) => readFileSync(p, "utf8");

// ── Auth: middleware ───────────────────────────────────────────────────────

let mwClaims: Record<string, unknown> | null;
let mwThrows: boolean;
let mwRotate: boolean;
let mwGetUserCalls: number;
let mwGetClaimsCalls: number;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: (c: { name: string; value: string; options?: object }[]) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        mwGetClaimsCalls++;
        if (mwThrows) throw new Error("refresh_token_not_found");
        // Simula la rotación del token dentro de getSession().
        if (mwRotate) opts.cookies.setAll([{ name: "sb-test-auth-token", value: "nuevo", options: { path: "/" } }]);
        return { data: mwClaims ? { claims: mwClaims } : null, error: null };
      },
      getUser: async () => {
        mwGetUserCalls++;
        return { data: { user: null }, error: null };
      },
    },
  }),
}));

// ── Auth: sesión ───────────────────────────────────────────────────────────

let claims: Record<string, unknown> | null;
let profile: Record<string, unknown> | null;
let profileError: { message: string } | null;
let fallbackReferee: Record<string, unknown> | null;
let consultas: { table: string; cols: string }[];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: claims ? { claims } : null, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = (cols: string) => {
        consultas.push({ table, cols });
        return q;
      };
      q.eq = () => q;
      q.maybeSingle = () =>
        Promise.resolve(
          table === "profiles"
            ? { data: profileError ? null : profile, error: profileError }
            : { data: fallbackReferee, error: null },
        );
      return q;
    },
  }),
}));

const { updateSession } = await import("@/lib/supabase/middleware");
const { getJudgeSession, getSession } = await import("@/lib/auth/session");
const { SessionProfileReadError } = await import("@/lib/auth/session-errors");
const { SIGN_IN_SIN_ACCESO } = await import("@/lib/auth/sign-in-redirect");
const { marcarLeidas } = await import("@/components/notifications/bandeja");
const { createRefreshCoalescer } = await import("@/components/realtime/refresh-coalescer");
const syncEvents = await import("@/lib/realtime/sync-events");

const juez = {
  id: "u-j",
  email: "ana@aep.test",
  nombre: "Ana Roa",
  rol_label: "Juez",
  iniciales: "AR",
  role: "juez",
  zona: "SUR",
  activo: true,
};

beforeEach(() => {
  mwClaims = { sub: "u-1" };
  mwThrows = false;
  mwRotate = false;
  mwGetUserCalls = 0;
  mwGetClaimsCalls = 0;
  claims = { sub: "u-j", email: "ana@aep.test", user_metadata: {}, app_metadata: {} };
  profile = { ...juez, referees: [{ id: "r-7", zona: "CENTRO" }] };
  profileError = null;
  fallbackReferee = null;
  consultas = [];
});

describe("middleware: un viaje menos a Auth", () => {
  const req = (path: string) => new NextRequest(new URL(path, "https://app.test"));

  it("verifica con getClaims y nunca con getUser", async () => {
    const res = await updateSession(req("/referees"));
    expect(mwGetClaimsCalls).toBe(1);
    expect(mwGetUserCalls).toBe(0);
    expect(res.headers.get("location")).toBeNull();
  });

  it("sin claims (o sin sub) manda a /sign-in, y en /api responde 401", async () => {
    mwClaims = null;
    expect((await updateSession(req("/referees"))).headers.get("location")).toBe("https://app.test/sign-in");
    mwClaims = { email: "x@aep.test" };
    expect((await updateSession(req("/referees"))).headers.get("location")).toBe("https://app.test/sign-in");
    mwClaims = null;
    expect((await updateSession(req("/api/v1/algo"))).status).toBe(401);
  });

  it("un refresco caducado que lanza cuenta como no autenticado", async () => {
    mwThrows = true;
    expect((await updateSession(req("/"))).headers.get("location")).toBe("https://app.test/sign-in");
  });

  it("con sesión, /sign-in vuelve a / salvo el retorno sin acceso", async () => {
    expect((await updateSession(req("/sign-in"))).headers.get("location")).toBe("https://app.test/");
    // Quien vuelve sin acceso se queda en /sign-in (si no, bucle de redirecciones).
    const vuelve = await updateSession(req(SIGN_IN_SIN_ACCESO));
    expect(vuelve.headers.get("location")).toBeNull();
  });

  it("las cookies rotadas por getClaims viajan también en la redirección", async () => {
    mwRotate = true;
    const res = await updateSession(req("/sign-in"));
    expect(res.headers.get("location")).toBe("https://app.test/");
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("nuevo");
  });
});

describe("sesión del portal: la ficha llega con el perfil", () => {
  it("un juez con ficha enlazada no hace una segunda consulta a referees", async () => {
    const s = await getJudgeSession();
    expect(s).toMatchObject({ id: "u-j", role: "juez", refereeId: "r-7", zona: "CENTRO" });
    expect(consultas.map((c) => c.table)).toEqual(["profiles"]);
    expect(consultas[0]!.cols).toContain("referees(id, zona)");
  });

  it("acepta la ficha embebida como objeto", async () => {
    profile = { ...juez, referees: { id: "r-8", zona: "ANDALUCIA" } };
    expect(await getJudgeSession()).toMatchObject({ refereeId: "r-8", zona: "ANDALUCIA" });
  });

  it("sin ficha embebida cae a la consulta de siempre (y sin ficha no hay portal)", async () => {
    profile = { ...juez, referees: [] };
    fallbackReferee = { id: "r-9", zona: "NOROESTE" };
    expect(await getJudgeSession()).toMatchObject({ refereeId: "r-9", zona: "NOROESTE" });
    expect(consultas.map((c) => c.table)).toEqual(["profiles", "referees"]);

    consultas = [];
    fallbackReferee = null;
    expect(await getJudgeSession()).toBeNull();
  });

  it("al personal de gestión no se le pega ficha ni zona del censo", async () => {
    profile = {
      ...juez,
      role: "delegado_zona",
      rol_label: "Delegado de zona",
      zona: "SUR",
      referees: [{ id: "r-7", zona: "CENTRO" }],
    };
    const s = await getSession();
    expect(s).toMatchObject({ role: "delegado_zona", zona: "ANDALUCIA" });
    expect(s?.refereeId).toBeUndefined();
    expect(await getJudgeSession()).toBeNull();
  });

  it("un juez no entra en la gestión aunque tenga ficha", async () => {
    expect(await getSession()).toBeNull();
  });

  it("una cuenta inactiva se queda fuera aunque tenga ficha", async () => {
    profile = { ...juez, activo: false, referees: [{ id: "r-7", zona: "CENTRO" }] };
    expect(await getJudgeSession()).toBeNull();
  });

  it("un fallo de lectura del perfil sigue siendo un error, no «sin acceso»", async () => {
    profileError = { message: "timeout" };
    await expect(getJudgeSession()).rejects.toBeInstanceOf(SessionProfileReadError);
  });
});

// ── Campana ────────────────────────────────────────────────────────────────

describe("campana: marcar leídos sin repintar la página", () => {
  const item = (id: string, leidaAt?: string) => ({
    id,
    userId: "u",
    tipo: "designacion" as const,
    titulo: id,
    createdAt: "2026-10-01T10:00:00.000Z",
    leidaAt,
  });

  it("estampa leidaAt y descuenta solo los enviados", () => {
    const b = { items: [item("a"), item("b"), item("c", "2026-10-02T00:00:00.000Z")], sinLeer: 5 };
    const r = marcarLeidas(b, ["a", "b"], "2026-10-11T00:00:00.000Z");
    // Los que no caben en la lista siguen contando como sin leer.
    expect(r.sinLeer).toBe(3);
    expect(r.items.map((x) => x.leidaAt)).toEqual([
      "2026-10-11T00:00:00.000Z",
      "2026-10-11T00:00:00.000Z",
      "2026-10-02T00:00:00.000Z",
    ]);
  });

  it("no resta dos veces si otro refresco ya trajo la bandeja leída", () => {
    const b = { items: [item("a", "2026-10-11T00:00:00.000Z")], sinLeer: 0 };
    expect(marcarLeidas(b, ["a"], "2026-10-11T00:00:01.000Z")).toBe(b);
  });

  it("baja el globo al momento y refresca después del PATCH (trae avisos nuevos)", () => {
    const src = leer("src/components/notifications/notification-bell.tsx");
    // El refresco va DESPUÉS de marcar en local, dentro del then del PATCH.
    expect(src).toMatch(/setBandeja\(\(b\) => marcarLeidas\(b, vistos, ahora\)\);\s*router\.refresh\(\);/);
    expect(src).toContain("setBandeja(initial)");
    // Los que eran nuevos al abrir siguen marcados mientras el menú esté abierto.
    expect(src).toContain("nuevosAlAbrir.has(n.id)");
  });
});

// ── Tiempo real: eco propio + refresco local = un solo refresco ────────────

describe("refrescos: el eco y el guardado propio se funden", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const nuevo = () => {
    const fired: (string | null)[] = [];
    const c = createRefreshCoalescer({ debounceMs: 600, maxWaitMs: 2000, fire: (s) => fired.push(s) });
    return { c, fired };
  };

  it("eco en tiempo real y petición local dan UN refresco, que sigue avisando", () => {
    const { c, fired } = nuevo();
    c.remote("realtime"); // el eco llega antes que la respuesta de la API
    vi.advanceTimersByTime(200);
    c.local();
    vi.advanceTimersByTime(600);
    expect(fired).toEqual(["realtime"]);
    vi.advanceTimersByTime(5000);
    expect(fired).toHaveLength(1);
  });

  it("solo locales: refresca sin avisar a las pantallas con estado cliente", () => {
    const { c, fired } = nuevo();
    c.local();
    c.local();
    vi.advanceTimersByTime(600);
    expect(fired).toEqual([null]);
  });

  it("el último aviso remoto decide, como antes", () => {
    const { c, fired } = nuevo();
    c.remote("realtime");
    c.remote("poll");
    vi.advanceTimersByTime(600);
    expect(fired).toEqual(["poll"]);
  });

  it("una ráfaga larga no aplaza el refresco más del tope", () => {
    const { c, fired } = nuevo();
    for (let i = 0; i < 10; i++) {
      c.local();
      vi.advanceTimersByTime(500);
    }
    // 5 s de clics cada 500 ms: refrescos a los ~2 s, no uno solo al final.
    expect(fired.length).toBeGreaterThanOrEqual(2);
  });

  it("cancelar retira solo lo local; un aviso remoto pendiente se mantiene", () => {
    const { c, fired } = nuevo();
    c.local();
    c.cancelLocal();
    vi.advanceTimersByTime(3000);
    expect(fired).toEqual([]);

    c.local();
    c.remote("realtime");
    c.cancelLocal();
    vi.advanceTimersByTime(600);
    expect(fired).toEqual(["realtime"]);
  });

  it("dispose no deja nada pendiente", () => {
    const { c, fired } = nuevo();
    c.remote("realtime");
    c.dispose();
    vi.advanceTimersByTime(3000);
    expect(fired).toEqual([]);
  });
});

describe("requestServerRefresh", () => {
  it("sin AppRealtimeSync montado devuelve false (quien llama refresca solo)", () => {
    expect(syncEvents.requestServerRefresh()).toBe(false);
    expect(() => syncEvents.cancelServerRefreshRequest()).not.toThrow();
  });

  it("con él montado, encola y cancela en su temporizador; solo se desregistra el suyo", () => {
    const a = { request: vi.fn(), cancel: vi.fn() };
    const b = { request: vi.fn(), cancel: vi.fn() };
    syncEvents.registerServerRefreshScheduler(a);
    syncEvents.registerServerRefreshScheduler(b);
    syncEvents.unregisterServerRefreshScheduler(a); // limpieza tardía del montaje anterior
    expect(syncEvents.requestServerRefresh()).toBe(true);
    syncEvents.cancelServerRefreshRequest();
    expect(b.request).toHaveBeenCalledTimes(1);
    expect(b.cancel).toHaveBeenCalledTimes(1);
    expect(a.request).not.toHaveBeenCalled();
    syncEvents.unregisterServerRefreshScheduler(b);
    expect(syncEvents.requestServerRefresh()).toBe(false);
  });

  it("la tarima pide su refresco al temporizador compartido y conserva el respaldo local", () => {
    const src = leer("src/components/competitions/roster-builder.tsx");
    expect(src).toContain("if (requestServerRefresh()) return;");
    expect(src).toContain("cancelServerRefreshRequest();");
    expect(src).toContain("if (!requestServerRefresh()) router.refresh();");
    const sync = leer("src/components/realtime/app-realtime-sync.tsx");
    // El registro va fuera de la guarda de Supabase: el backend en memoria
    // también necesita el refresco propio.
    const registro = sync.indexOf("registerServerRefreshScheduler(scheduler)");
    const guarda = sync.indexOf("if (!isSupabaseConfigured()) return;\n\n    const supabase");
    expect(registro).toBeGreaterThan(0);
    expect(guarda).toBeGreaterThan(registro);
  });
});

// ── Carga ──────────────────────────────────────────────────────────────────

describe("carga del armazón", () => {
  it("el portal tiene límite de carga estático (sin datos del juez)", () => {
    expect(existsSync("src/app/portal/loading.tsx")).toBe(true);
    const src = leer("src/app/portal/loading.tsx");
    expect(src).not.toMatch(/getJudgeSession|loadPortal|dataService|async /);
  });

  it("supabase-js no entra estático en el layout del panel", () => {
    const shell = leer("src/components/layout/app-shell.tsx");
    expect(shell).not.toMatch(/import \{ AppRealtimeSync \}/);
    expect(shell).toMatch(/dynamic\(\s*\(\) => import\("@\/components\/realtime\/app-realtime-sync"\)/);
    expect(shell).toContain("ssr: false");
  });
});
