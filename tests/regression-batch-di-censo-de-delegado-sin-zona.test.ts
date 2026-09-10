import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/types";

/**
 * El censo de un delegado cuya zona no se reconoce.
 *
 * `zone-scope` existe justamente por esto y lo dice: `undefined` significaba
 * dos cosas que no son la misma —«este usuario no tiene que ver una parte» (un
 * super admin) y «es delegado de zona pero su zona NO se reconoce»—, y las dos
 * caían en el mismo `if (userZone)`, así que la segunda se quedaba sin filtro.
 *
 * El calendario y los exámenes ya cerraban esa puerta. El censo, no: un
 * delegado con la zona en blanco o ilegible en su perfil leía la ficha de todos
 * los jueces de España —teléfono, domicilio, coordenadas y notas incluidos,
 * porque `stripRefereePII` solo recorta para `solo_ver`—.
 *
 * Es la lista que la propia documentación de `zoneVisibilityFilter` nombra:
 * «la alternativa era enseñarle el censo y el calendario de todas las zonas».
 */

const filas = [
  { id: "j-1", nombre: "Ana Ruiz", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true },
  { id: "j-2", nombre: "Luis Soto", zona: "ANDALUCIA", nivel: "Regional", estado: "Activo", disp: true },
  { id: "j-3", nombre: "Eva Pons", zona: "MEDITERRANEO", nivel: "Regional", estado: "Activo", disp: true },
];

let filtroZona: string | undefined;

function q() {
  const self: Record<string, unknown> = {};
  Object.assign(self, {
    select: () => self,
    order: () => self,
    ilike: () => self,
    eq: (columna: string, valor: string) => {
      if (columna === "zona") filtroZona = valor;
      return self;
    },
    range: (from: number) => {
      const visibles = filtroZona ? filas.filter((f) => f.zona === filtroZona) : filas;
      return Promise.resolve({ data: from === 0 ? visibles : [], error: null });
    },
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => q() }),
}));
// Se conserva el resto del módulo: `supabase-referees` reexporta varias de sus
// funciones y sin ellas ni siquiera carga.
vi.mock("@/server/services/referee-sanctions", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  expireStaleSanctions: async () => undefined,
}));

const { refereeService } = await import("@/server/services/supabase-referees");
const { getReferees: getRefereesMemoria } = await import("@/server/services/memory-referees");
const { getStore } = await import("@/server/store");

function delegado(zona: string | undefined): SessionUser {
  return {
    id: "u-1",
    email: "delegado@aep.test",
    nombre: "Delegado",
    rol: "Delegado de Zona",
    iniciales: "DZ",
    role: "delegado_zona",
    zona,
  };
}

const SUPER_ADMIN: SessionUser = {
  id: "u-0",
  email: "admin@aep.test",
  nombre: "Admin",
  rol: "Super Admin",
  iniciales: "AD",
  role: "super_admin",
};

beforeEach(() => {
  filtroZona = undefined;
});

describe("un delegado de zona sin zona utilizable", () => {
  it("con la zona en blanco no lee el censo entero", async () => {
    const censo = await refereeService.getReferees({ user: delegado(undefined) });
    expect(censo).toEqual([]);
  });

  it("con una zona que no se reconoce, tampoco", async () => {
    const censo = await refereeService.getReferees({ user: delegado("Zona Inventada") });
    expect(censo).toEqual([]);
  });

  it("y no lo arregla pedir explícitamente otra zona", async () => {
    const censo = await refereeService.getReferees({
      user: delegado(undefined),
      zona: "ANDALUCIA",
    });
    expect(censo).toEqual([]);
  });
});

describe("los que sí tienen zona siguen viendo lo suyo", () => {
  it("el delegado de CENTRO ve solo su zona", async () => {
    const censo = await refereeService.getReferees({ user: delegado("CENTRO") });
    expect(censo.map((r) => r.id)).toEqual(["j-1"]);
  });

  it("y con un alias antiguo de su zona, también", async () => {
    const censo = await refereeService.getReferees({ user: delegado("MAD") });
    expect(censo.map((r) => r.id)).toEqual(["j-1"]);
  });

  it("un super admin sigue viendo el censo entero", async () => {
    const censo = await refereeService.getReferees({ user: SUPER_ADMIN });
    expect(censo.map((r) => r.id)).toEqual(["j-1", "j-2", "j-3"]);
  });
});

describe("el backend en memoria dice lo mismo", () => {
  beforeEach(() => {
    const store = getStore();
    store.referees.length = 0;
    store.referees.push(
      ...filas.map((f) => ({
        ...f,
        eventos: 0,
        ultimo: "",
        iniciales: "XX",
      })),
    );
  });

  it("sin zona utilizable, censo vacío", async () => {
    expect(await getRefereesMemoria({ user: delegado(undefined) })).toEqual([]);
    expect(await getRefereesMemoria({ user: delegado("Zona Inventada") })).toEqual([]);
  });

  it("con zona, solo la suya", async () => {
    const censo = await getRefereesMemoria({ user: delegado("CENTRO") });
    expect(censo.map((r) => r.id)).toEqual(["j-1"]);
  });

  it("y un super admin lo ve todo", async () => {
    const censo = await getRefereesMemoria({ user: SUPER_ADMIN });
    expect(censo.map((r) => r.id)).toEqual(["j-1", "j-2", "j-3"]);
  });
});
