import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tres lecturas y dos escrituras de sanciones tiraban el `error` de
 * `supabase-js`. El resultado era siempre el mismo: «Sanción no encontrada».
 *
 * Una sanción es lo que impide sentar a un juez en una tarima. Que una lectura
 * fallida se presente como «no existe» y una escritura fallida como «ya está
 * revocada» son las dos mentiras que peor caen aquí: la primera hace pensar
 * que alguien la borró, la segunda deja al juez sancionado mientras la
 * pantalla dice lo contrario.
 */

type Fallo = { message: string; code?: string } | null;
let falloLectura: Fallo = null;
let falloEscritura: Fallo = null;

const fila = {
  id: "san-1",
  referee_id: "ref-1",
  referee_name: "Juez Uno",
  zona: "CENTRO",
  status: "activa",
  motivo: "motivo suficientemente largo",
  fecha_inicio: "2026-01-01",
  fecha_fin: "2099-01-01",
  impuesta_por_id: "u1",
  impuesta_por_nombre: "Admin",
  created_at: "2026-01-01T00:00:00.000Z",
};

function clienteFalso() {
  const q: Record<string, unknown> = {};
  let escribiendo = false;
  Object.assign(q, {
    select: () => q,
    update: () => ((escribiendo = true), q),
    insert: () => ((escribiendo = true), q),
    eq: () => q,
    gte: () => q,
    lte: () => q,
    order: () => q,
    maybeSingle: async () => ({ data: falloLectura ? null : fila, error: falloLectura }),
    single: async () =>
      escribiendo
        ? { data: falloEscritura ? null : fila, error: falloEscritura }
        : { data: falloLectura ? null : fila, error: falloLectura },
  });
  return { from: () => q };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => clienteFalso() }));

const { getRefereeSanction, markSanctionDelegateNotified } = await import(
  "@/server/services/referee-sanctions"
);

beforeEach(() => {
  falloLectura = null;
  falloEscritura = null;
});

describe("una sanción que no se puede leer no es una sanción que no existe", () => {
  it("la lectura fallida se dice, no se disfraza de ausencia", async () => {
    falloLectura = { message: "permission denied for table referee_sanctions" };
    await expect(getRefereeSanction("san-1")).rejects.toThrow(/referee_sanctions/);
  });

  it("una sanción que de verdad no está sigue devolviendo «no hay»", async () => {
    await expect(getRefereeSanction("san-1")).resolves.toMatchObject({ id: "san-1" });
  });

  it("marcar el aviso al delegado falla diciéndolo, no como «no encontrada»", async () => {
    falloEscritura = { message: "deadlock detected" };
    await expect(markSanctionDelegateNotified("san-1")).rejects.toThrow(/referee_sanctions/);
  });

  it("sin fallos, el aviso se marca", async () => {
    await expect(markSanctionDelegateNotified("san-1")).resolves.toMatchObject({ id: "san-1" });
  });
});
