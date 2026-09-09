import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Los contadores de la barra lateral leían campeonatos y aprobaciones
 * pendientes descartando el `error` de supabase-js:
 *
 *   const [{ data: comps }, { data: apprRows }] = await Promise.all([…]);
 *
 * No se puede lanzar —los pide el layout del panel, así que un corte de
 * lectura tumbaría TODAS las pantallas a la vez—, y la barra lateral ya oculta
 * el distintivo cuando el número es 0, así que degradar no dice ninguna
 * mentira. Pero callarse el motivo dejaba el atajo «tarima activa» y la
 * bandeja de aprobaciones sin distintivo y sin forma de saber por qué.
 */

type Fallo = { message: string } | null;
const fallos: Record<string, Fallo> = {};
const filas: Record<string, Record<string, unknown>[]> = {};

function q(tabla: string): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  const resultado = () => ({
    data: fallos[tabla] ? null : (filas[tabla] ?? []),
    error: fallos[tabla] ?? null,
  });
  Object.assign(self, {
    select: () => self,
    eq: () => self,
    order: () => self,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resultado()).then(resolve),
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (tabla: string) => q(tabla) }),
}));

const { competitionService } = await import("@/server/services/supabase-competitions");

let logs: string[];

beforeEach(() => {
  for (const k of Object.keys(fallos)) delete fallos[k];
  for (const k of Object.keys(filas)) delete filas[k];
  logs = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
});

describe("los contadores de la barra lateral", () => {
  it("cuentan lo que hay cuando las dos lecturas salen bien", async () => {
    filas.competitions = [{ id: "evt-1", fecha: "2026-05-01", estado: "Incompleto" }];
    filas.approval_proposals = [{ zona: "CENTRO" }, { zona: "CENTRO" }];

    const counts = await competitionService.getNavCountsFast();
    expect(counts.competitions).toBe(1);
    expect(counts.approvals).toBe(2);
    expect(logs).toEqual([]);
  });

  it("no tumban el panel si falla una lectura, pero dejan constancia", async () => {
    fallos.competitions = { message: "statement timeout" };
    filas.approval_proposals = [{ zona: "CENTRO" }];

    const counts = await competitionService.getNavCountsFast();
    expect(counts.competitions).toBe(0);
    expect(counts.activeRosterHref).toBe("/competitions");
    // La otra lectura sí salió: su número no se pierde por culpa de la primera.
    expect(counts.approvals).toBe(1);
    expect(logs.join(" ")).toContain("nav.competitions");
    expect(logs.join(" ")).toContain("statement timeout");
  });

  it("y lo mismo cuando la que falla es la de aprobaciones", async () => {
    filas.competitions = [{ id: "evt-1", fecha: "2026-05-01", estado: "Incompleto" }];
    fallos.approval_proposals = { message: "permission denied" };

    const counts = await competitionService.getNavCountsFast();
    expect(counts.competitions).toBe(1);
    expect(counts.approvals).toBe(0);
    expect(logs.join(" ")).toContain("nav.approvals");
  });
});
