import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Borrar un campeonato borra antes sus tres tablas hijas: tarima, propuestas de
 * aprobación y bitácora. `supabase-js` no lanza —devuelve `{ error }`— y esos
 * tres resultados no se miraban: si uno fallaba, el campeonato se borraba
 * igual y sus filas se quedaban apuntando a un id que ya no existe.
 *
 * Y ese id vuelve. `createCompetition` numera con `max(evt-NNN) + 1`, así que
 * borrar el último campeonato y crear otro reutiliza su identificador: la
 * tarima huérfana se convertía en la tarima del campeonato nuevo, sin que
 * nadie la hubiera asignado.
 */

type Fallos = Partial<Record<"roster_assignments" | "approval_proposals" | "roster_history", { message: string; code?: string }>>;

let fallos: Fallos = {};
let borrados: string[] = [];

function clienteFalso() {
  return {
    from(tabla: string) {
      return {
        select: () => ({
          // Recuento de liquidaciones: ninguna.
          eq: async () => ({ count: 0, error: null }),
        }),
        delete: () => ({
          // `.eq()` se espera directamente en los hijos y se encadena con
          // `.select("id")` en el campeonato: sirve para las dos formas.
          eq: () => {
            const resultado = () => {
              const error = fallos[tabla as keyof Fallos] ?? null;
              if (!error && !borrados.includes(tabla)) borrados.push(tabla);
              return { data: tabla === "competitions" ? [{ id: "evt-009" }] : null, error };
            };
            return {
              select: async () => resultado(),
              then: (resolve: (v: unknown) => unknown) => Promise.resolve(resultado()).then(resolve),
            };
          },
        }),
      };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => clienteFalso(),
}));
vi.mock("@/server/services/supabase-helpers", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    db: () => clienteFalso(),
    // Las sondas de columnas hablan con la base; aquí se fijan.
    hasApprovalCompetitionColumns: async () => true,
    hasHistoryCompetitionColumn: async () => true,
  };
});

const { competitionService } = await import("@/server/services/supabase-competitions");

beforeEach(() => {
  fallos = {};
  borrados = [];
});

describe("borrar un campeonato cuando falla una tabla hija", () => {
  it("no borra el campeonato si la tarima no se ha podido borrar", async () => {
    fallos.roster_assignments = { message: "permission denied for table roster_assignments" };
    await expect(competitionService.deleteCompetition("evt-009")).rejects.toThrow(
      /No se ha borrado el campeonato/,
    );
    expect(borrados).not.toContain("competitions");
  });

  it("tampoco si fallan las propuestas de aprobación", async () => {
    fallos.approval_proposals = { message: "deadlock detected" };
    await expect(competitionService.deleteCompetition("evt-009")).rejects.toThrow(
      /propuestas de aprobación/,
    );
    expect(borrados).not.toContain("competitions");
  });

  it("el mensaje no lleva el texto de Postgres", async () => {
    fallos.roster_history = { message: "permission denied for relation roster_history" };
    await expect(competitionService.deleteCompetition("evt-009")).rejects.toThrow(
      /^(?!.*permission denied)/,
    );
  });

  it("una tabla que no existe todavía no impide el borrado", async () => {
    // Instalaciones sin la migración correspondiente: no hay nada que borrar.
    fallos.roster_history = { message: "relation does not exist", code: "42P01" };
    await expect(competitionService.deleteCompetition("evt-009")).resolves.toBe(true);
    expect(borrados).toContain("competitions");
  });

  it("sin fallos, borra los tres hijos y el campeonato", async () => {
    await expect(competitionService.deleteCompetition("evt-009")).resolves.toBe(true);
    expect(borrados).toEqual([
      "roster_assignments",
      "approval_proposals",
      "roster_history",
      "competitions",
    ]);
  });
});
