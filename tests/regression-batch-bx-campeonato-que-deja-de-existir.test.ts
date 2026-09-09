import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getCompetition` es la lectura más usada de la aplicación: el detalle, la
 * compensación y CADA mutación de tarima empiezan por ahí, y todas contestan
 * «Competición no encontrada» cuando devuelve `undefined`.
 *
 * Descartaba el `error` de `supabase-js`. Un corte de un segundo hacía que el
 * campeonato dejara de existir para todo el mundo a la vez, en mitad de una
 * competición, y con la tarima abierta delante.
 */

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
let fallo: QueryResult["error"] = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabla: string) => {
      const q: Record<string, unknown> = {};
      // El fallo se aplica solo a `competitions`: lo que se prueba es esa
      // lectura, no las asignaciones que la acompañan.
      const err = () => (tabla === "competitions" ? fallo : null);
      const resultado = () => ({ data: err() ? null : [], error: err() });
      Object.assign(q, {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        range: async () => resultado(),
        single: async () => ({ data: null, error: err() }),
        maybeSingle: async () => ({ data: null, error: err() }),
        then: (r: (v: unknown) => unknown) => Promise.resolve(resultado()).then(r),
      });
      return q;
    },
  }),
}));

const { competitionService } = await import("@/server/services/supabase-competitions");

beforeEach(() => {
  fallo = null;
});

describe("un campeonato que no se puede leer no es un campeonato que no existe", () => {
  it("el fallo de lectura se dice en vez de disfrazarse de ausencia", async () => {
    fallo = { message: "permission denied for table competitions" };
    await expect(competitionService.getCompetition("evt-1")).rejects.toThrow(/competitions/);
  });

  it("«ninguna fila» (PGRST116) sigue siendo una respuesta, no un error", async () => {
    fallo = { code: "PGRST116", message: "no rows returned" };
    await expect(competitionService.getCompetition("evt-1")).resolves.toBeUndefined();
  });
});

describe("las mutaciones de tarima ya no repiten las mismas cuatro líneas", () => {
  it("todas pasan por el mismo cargador, que sí tiene el fallo cubierto", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raiz = join(process.cwd(), "src/app/api/v1/competitions/[id]/roster");
    const rutas: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (nombre === "route.ts") rutas.push(ruta);
      }
    };
    recorrer(raiz);
    expect(rutas.length).toBeGreaterThan(5);
    for (const ruta of rutas) {
      const src = readFileSync(ruta, "utf8");
      // Nadie vuelve a escribir a mano el par lectura + guardián: la lectura
      // quedaba siempre fuera de cualquier `try`.
      expect(src, ruta).not.toMatch(/const blocked = guardRosterWrite\(/);
    }
  });
});
