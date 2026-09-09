import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `resolveZoneCode` devuelve `undefined` en dos casos que no son el mismo:
 * «este usuario no tiene restricción» (un super admin) y «es delegado de zona
 * y su zona NO se reconoce». Escrito como
 *
 *     const userZone = user.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
 *     if (userZone && …) // filtrar
 *
 * los dos caen en el mismo sitio y el segundo se salta el filtro entero. Para
 * eso existe `zone-scope`, que separa los tres casos.
 *
 * Quedaban dos sitios sin pasar por ahí, y el peor son las alertas de sanción:
 * un delegado con la zona mal escrita en su perfil veía en su panel las
 * sanciones disciplinarias de TODAS las zonas. Y no tenía por qué notarlo,
 * porque el censo y el listado de campeonatos sí fallan cerrados: su panel
 * salía vacío salvo por esto.
 */

type Fila = Record<string, unknown>;
const filas: Record<string, Fila[]> = {};

function q(tabla: string): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  let zonaFiltro: string | undefined;
  const resultado = () => ({
    data: (filas[tabla] ?? []).filter(
      (f) => zonaFiltro === undefined || String(f.zona ?? "") === zonaFiltro,
    ),
    error: null,
  });
  Object.assign(self, {
    select: () => self,
    eq: (col: string, val: unknown) => {
      if (col === "zona") zonaFiltro = String(val);
      return self;
    },
    gte: () => self,
    lt: () => self,
    order: () => self,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resultado()).then(resolve),
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (tabla: string) => q(tabla) }),
}));

const { getSanctionAlerts } = await import("@/server/services/referee-sanctions");
const { competitionService } = await import("@/server/services/supabase-competitions");

/** Delegado de zona cuya `zona` no corresponde a ninguna zona AEP. */
const DELEGADO_ROTO = {
  id: "u1",
  nombre: "Dele Gado",
  iniciales: "DG",
  email: "d@aep.test",
  rol: "Delegado de zona",
  role: "delegado_zona" as const,
  zona: "zona-que-no-existe",
};

const DELEGADO_CENTRO = { ...DELEGADO_ROTO, zona: "CENTRO" };
const SUPER_ADMIN = { ...DELEGADO_ROTO, role: "super_admin" as const, zona: undefined };

beforeEach(() => {
  for (const k of Object.keys(filas)) delete filas[k];
  filas.referee_sanctions = [
    {
      id: "san-1",
      referee_id: "ref-1",
      referee_name: "Juez del Centro",
      zona: "CENTRO",
      status: "activa",
      fecha_inicio: "2026-01-01",
      fecha_fin: "2099-01-01",
      motivo: "x",
    },
    {
      id: "san-2",
      referee_id: "ref-2",
      referee_name: "Juez del Norte",
      zona: "NORTE",
      status: "activa",
      fecha_inicio: "2026-01-01",
      fecha_fin: "2099-01-01",
      motivo: "y",
    },
  ];
  filas.competitions = [
    { id: "evt-1", fecha: "2026-05-01", estado: "Incompleto", zona: "CENTRO" },
    { id: "evt-2", fecha: "2026-06-01", estado: "Incompleto", zona: "NORTE" },
  ];
  filas.approval_proposals = [];
});

describe("las alertas de sanción del panel", () => {
  it("un delegado con la zona ilegible no ve las sanciones de nadie", async () => {
    const alertas = await getSanctionAlerts(DELEGADO_ROTO, { skipExpire: true });
    expect(alertas).toEqual([]);
  });

  it("un delegado con zona buena sigue viendo las suyas y solo las suyas", async () => {
    const alertas = await getSanctionAlerts(DELEGADO_CENTRO, { skipExpire: true });
    expect(alertas.map((a) => a.zona)).toEqual(["CENTRO"]);
  });

  it("y quien no tiene restricción las ve todas", async () => {
    const alertas = await getSanctionAlerts(SUPER_ADMIN, { skipExpire: true });
    expect(alertas).toHaveLength(2);
  });
});

describe("el contador de campeonatos de la barra lateral", () => {
  it("no cuenta los de toda España cuando la zona del perfil es ilegible", async () => {
    const counts = await competitionService.getNavCountsFast(DELEGADO_ROTO);
    expect(counts.competitions).toBe(0);
  });

  it("cuenta los de su zona cuando la zona es buena", async () => {
    const counts = await competitionService.getNavCountsFast(DELEGADO_CENTRO);
    expect(counts.competitions).toBe(1);
  });

  it("y todos para quien no tiene restricción", async () => {
    const counts = await competitionService.getNavCountsFast(SUPER_ADMIN);
    expect(counts.competitions).toBe(2);
  });
});
