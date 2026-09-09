import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lecturas que tiraban el `error` de `supabase-js` y devolvían la lista vacía
 * o `undefined`. Cada una acaba diciendo algo que no es verdad:
 *
 *  - el historial de campeonatos de un juez, que es lo que se mira para
 *    decidir un ascenso, decía «no ha arbitrado nunca»;
 *  - la comprobación de si ya hay una propuesta pendiente decía «no la hay», y
 *    se enviaba una SEGUNDA propuesta del mismo campeonato;
 *  - la relectura posterior a una revisión decía «ya la revisó otro usuario»,
 *    justo después de haberla revisado tú.
 */

type Fallo = { message: string; code?: string } | null;
const fallos: Record<string, Fallo> = {};

// El juez existe: lo que se pone a prueba es lo que viene después de leerlo.
const FILA_JUEZ = { id: "ref-1", nombre: "Juez Uno", zona: "CENTRO", nivel: "Autonomico" };

function q(tabla: string): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  const resultado = () => ({ data: fallos[tabla] ? null : [], error: fallos[tabla] ?? null });
  const fila = () => ({
    data: fallos[tabla] ? null : tabla === "referees" ? FILA_JUEZ : null,
    error: fallos[tabla] ?? null,
  });
  Object.assign(self, {
    select: () => self,
    update: () => self,
    insert: () => self,
    eq: () => self,
    in: () => self,
    order: () => self,
    limit: () => resultado(),
    maybeSingle: async () => fila(),
    single: async () => fila(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resultado()).then(resolve),
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (tabla: string) => q(tabla) }),
}));

const { refereeService } = await import("@/server/services/supabase-referees");
const { rosterService } = await import("@/server/services/supabase-roster");
const { examsService } = await import("@/server/services/supabase-exams");

beforeEach(() => {
  for (const k of Object.keys(fallos)) delete fallos[k];
});

describe("el historial de un juez", () => {
  it("no se presenta vacío cuando la lectura de designaciones falla", async () => {
    fallos.roster_assignments = { message: "permission denied for table roster_assignments" };
    await expect(
      refereeService.getJudgeProfile(
        "ref-1",
        async () => [],
        async () => [],
      ),
    ).rejects.toThrow(/roster_assignments/);
  });
});

describe("la bitácora de la tarima", () => {
  it("una lectura fallida no es «aquí no ha pasado nada»", async () => {
    fallos.roster_history = { message: "statement timeout" };
    await expect(rosterService.getRosterHistory("evt-1")).rejects.toThrow(/roster_history/);
  });

  it("sin fallos devuelve la lista, aunque esté vacía", async () => {
    await expect(rosterService.getRosterHistory("evt-1")).resolves.toEqual([]);
  });
});

describe("revisar una propuesta", () => {
  it("una lectura fallida no se disfraza de «ya la revisó otro»", async () => {
    fallos.approval_proposals = { message: "deadlock detected" };
    await expect(
      rosterService.reviewApproval("apr-1", true, "Revisor", "u1", async () => undefined),
    ).rejects.toThrow(/No se pudo leer la propuesta/);
  });

  it("una propuesta que de verdad no está sigue devolviendo «no hay»", async () => {
    fallos.approval_proposals = { message: "no rows", code: "PGRST116" };
    await expect(
      rosterService.reviewApproval("apr-1", true, "Revisor", "u1", async () => undefined),
    ).resolves.toBeUndefined();
  });
});

describe("revisar una solicitud de ascenso", () => {
  it("una lectura fallida no se disfraza de «ya la revisó otro»", async () => {
    fallos.promotion_requests = { message: "statement timeout" };
    await expect(examsService.reviewPromotion("pro-1", true, "Revisor")).rejects.toThrow(
      /No se pudo leer la solicitud/,
    );
  });

  it("una solicitud que de verdad no está sigue devolviendo «no hay»", async () => {
    fallos.promotion_requests = { message: "no rows", code: "PGRST116" };
    await expect(examsService.reviewPromotion("pro-1", true, "Revisor")).resolves.toBeUndefined();
  });

  it("crear un informe sobre un juez ilegible no dice «juez no encontrado»", async () => {
    fallos.referees = { message: "permission denied for table referees" };
    await expect(
      examsService.createReport({
        subjectType: "juez",
        refereeId: "ref-1",
        zona: "CENTRO",
        tipo: "seguimiento",
        fecha: "2026-05-01",
        autorNombre: "Autor",
      } as Parameters<typeof examsService.createReport>[0]),
    ).rejects.toThrow(/referees: permission denied/);
  });
});
