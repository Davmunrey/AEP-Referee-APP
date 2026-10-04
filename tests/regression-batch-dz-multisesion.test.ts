import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Varios jueces trabajando a la vez sobre la misma tarima. Las escrituras de
// huecos eran «leer, comparar y escribir»: entre la lectura y la escritura
// otra persona podía ocupar el hueco y el upsert la pisaba sin aviso. Ahora la
// escritura es condicional en la propia base de datos.

// ── Capa Supabase ───────────────────────────────────────────────────────────
type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

let respond: (ctx: { table: string; op: string }) => QueryResult;
let writes: string[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = { table, op: "select" };
      const finish = () => {
        if (state.op !== "select") writes.push(`${table}.${state.op}`);
        return respond(state);
      };
      const q = {
        select: () => q,
        update: () => ((state.op = "update"), q),
        insert: () => ((state.op = "insert"), q),
        upsert: () => ((state.op = "upsert"), q),
        delete: () => ((state.op = "delete"), q),
        eq: () => q,
        neq: () => q,
        in: () => q,
        gte: () => q,
        lte: () => q,
        order: () => q,
        limit: () => q,
        single: async () => finish(),
        maybeSingle: async () => finish(),
        range: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { rosterService } from "@/server/services/supabase-roster";
import { RosterSlotConflictError, RosterTemplateConflictError } from "@/lib/competitions/service-types";
import { rosterTemplateHash } from "@/lib/roster-template-hash";
import type { Competition, Referee } from "@/lib/types";

const competition = {
  id: "c1",
  nombre: "Copa",
  tipo: "AEP-2",
  fecha: "2026-03-21",
  fechaFin: "2026-03-22",
  sede: "Madrid",
  zona: "CENTRO",
  sesiones: 1,
  requeridos: 2,
  confirmados: 1,
  estado: "Incompleto",
  aprobacion: "Sin propuesta",
} as Competition;

const referee = (id: string, nombre: string) =>
  ({ id, nombre, zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true, eventos: 0 }) as Referee;

const template = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
    pesajeRoles: [],
  },
];

function tarima(ocupante: string | null, escritura: { code?: string; data?: unknown[] }) {
  respond = ({ table, op }) => {
    if (table === "judge_compensation_claims") return { data: [], error: null };
    if (table === "roster_assignments") {
      if (op === "select") {
        return {
          data: ocupante ? [{ slot_key: "S1_central_0", referee_id: ocupante, flags: {}, cross_zone: false }] : [],
          error: null,
        };
      }
      if (escritura.code) return { data: null, error: { code: escritura.code, message: "duplicate key" } };
      return { data: escritura.data ?? [], error: null };
    }
    if (table === "competitions") {
      return { data: { ...competition, fecha_fin: competition.fechaFin, template }, error: null };
    }
    return { data: [], error: null };
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  writes = [];
});

const getComp = async () => competition;
const getRef = async (id: string) => referee(id, id === "j1" ? "Ana Ruiz" : "Luis Gil");

describe("dos jueces sobre el mismo hueco a la vez", () => {
  it("hueco vacío: se inserta (no upsert) y, si otro llegó antes, es un conflicto", async () => {
    tarima(null, { code: "23505" });
    const res = await rosterService.assignReferee("c1", "S1_central_0", "j2", "Delegado", getComp, getRef);
    expect(res.conflict).toBe(true);
    expect(res.error).toMatch(/Otro usuario acaba de cambiar ese hueco/);
    expect(writes).toEqual(["roster_assignments.insert"]);
  });

  it("sustituir: solo si sigue el juez que se leyó; si no, conflicto", async () => {
    tarima("j1", { data: [] });
    const res = await rosterService.assignReferee("c1", "S1_central_0", "j2", "Delegado", getComp, getRef);
    expect(res.conflict).toBe(true);
    expect(writes).toEqual(["roster_assignments.update"]);
  });

  it("liberar un hueco que otro acaba de cambiar no borra su asignación", async () => {
    tarima("j1", { data: [] });
    await expect(rosterService.clearSlot("c1", "S1_central_0", "Delegado")).rejects.toBeInstanceOf(
      RosterSlotConflictError,
    );
  });
});

describe("importar un cuadrante mientras otro asigna", () => {
  it("el hueco que otro ocupó entre la vista previa y «Aplicar» no se pisa", async () => {
    // Al leer está vacío; el INSERT … ON CONFLICT DO NOTHING no lo devuelve
    // porque otro usuario lo ocupó entretanto.
    tarima(null, { data: [] });
    const res = await rosterService.assignRefereesBatch(
      "c1",
      [{ slotKey: "S1_central_0", refereeId: "j2" }],
      "Delegado",
      getComp,
      async (ids) => new Map(ids.map((id) => [id, referee(id, "Luis Gil")])),
    );
    expect(res.results[0]!.ok).toBe(false);
    expect(res.results[0]!.error).toMatch(/Otro usuario cambió ese hueco/);
    expect(writes).toEqual(["roster_assignments.upsert"]);
  });
});

describe("dos personas editando la plantilla a la vez", () => {
  it("la huella no depende del orden de las claves", () => {
    const a = [{ sesion: "S1", nombre: "Sesión 1", roles: [] }] as never;
    const b = [{ roles: [], nombre: "Sesión 1", sesion: "S1" }] as never;
    expect(rosterTemplateHash(a)).toBe(rosterTemplateHash(b));
    expect(rosterTemplateHash(a)).not.toBe(rosterTemplateHash([]));
  });

  it("guardar sobre una versión que ya cambió es un 409, no una sobrescritura", async () => {
    tarima(null, { data: [] });
    await expect(
      rosterService.saveCompetitionTemplate("c1", [], "Delegado", getComp, rosterTemplateHash([])),
    ).rejects.toBeInstanceOf(RosterTemplateConflictError);
    expect(writes).toEqual([]);
  });

  it("el constructor vuelve a pedir los datos que se apartaron mientras se editaba", () => {
    const src = readFileSync("src/components/competitions/roster-builder.tsx", "utf8");
    expect(src).toContain("skippedServerUpdateRef.current = true");
    expect(src).toContain("api.saveTemplate(competition.id, next, baseHash)");
  });
});
