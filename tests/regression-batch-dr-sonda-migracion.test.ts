import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La sonda de columnas cacheaba «no existe» para toda la vida del proceso. Eso
// significa que aplicar la migración NO enciende la función: las instancias que
// ya estaban vivas siguen creyendo que la columna falta hasta que algo ajeno
// las recicle.
//
// No es hipotético. El 2026-09-10 la migración 034 creó
// `judge_compensation_claims.travel_amount_override` en producción desde el
// workflow, sin redespliegue. Una instancia caliente de antes seguiría
// descartando en silencio el importe manual de desplazamiento —dinero— con solo
// un aviso suelto en el log.
//
// Ahora un «no existe» caduca; un «existe» no, porque una columna no
// desaparece.

let respuesta: { error: { code?: string; message?: string } | null } = { error: null };
let consultas = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        limit: async () => {
          consultas += 1;
          return respuesta;
        },
      }),
    }),
  }),
}));

// La sonda es estado de módulo, así que cada test necesita su propia copia:
// sin esto, el primero que cachea «existe» —que no caduca a propósito— deja el
// resto de tests mirando ese veredicto.
async function sondaLimpia() {
  vi.resetModules();
  const mod = await import("@/server/services/supabase-helpers");
  return mod.hasCompensationOverrideColumn;
}

const FALTA = { error: { code: "42703", message: 'column "x" does not exist' } };
const EXISTE = { error: null };
const CORTE = { error: { code: "ECONNRESET", message: "fetch failed" } };

beforeEach(() => {
  consultas = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("sonda de columnas y migraciones aplicadas en caliente", () => {
  it("no repregunta mientras el «no existe» sigue fresco", async () => {
    const hasCompensationOverrideColumn = await sondaLimpia();
    respuesta = FALTA;
    expect(await hasCompensationOverrideColumn()).toBe(false);
    const tras = consultas;
    // Cuatro llamadas más dentro de la ventana: ni una consulta de más.
    vi.advanceTimersByTime(60_000);
    for (let i = 0; i < 4; i += 1) await hasCompensationOverrideColumn();
    expect(consultas).toBe(tras);
    expect(await hasCompensationOverrideColumn()).toBe(false);
  });

  it("vuelve a mirar pasada la ventana, y se entera de que la migración ya está", async () => {
    const hasCompensationOverrideColumn = await sondaLimpia();
    respuesta = FALTA;
    expect(await hasCompensationOverrideColumn()).toBe(false);

    // Alguien lanza el workflow de migraciones. La columna aparece SIN que se
    // reinicie nada.
    respuesta = EXISTE;
    // Dentro de la ventana la instancia sigue creyendo lo anterior.
    vi.advanceTimersByTime(4 * 60_000);
    expect(await hasCompensationOverrideColumn()).toBe(false);
    // Pasada la ventana, se entera sola.
    vi.advanceTimersByTime(2 * 60_000);
    expect(await hasCompensationOverrideColumn()).toBe(true);
  });

  it("una vez que existe, no se vuelve a preguntar nunca", async () => {
    const hasCompensationOverrideColumn = await sondaLimpia();
    respuesta = EXISTE;
    expect(await hasCompensationOverrideColumn()).toBe(true);
    const tras = consultas;
    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(await hasCompensationOverrideColumn()).toBe(true);
    expect(consultas).toBe(tras);
  });

  it("un corte de red no apaga la función: asume el esquema moderno y reintenta", async () => {
    const hasCompensationOverrideColumn = await sondaLimpia();
    respuesta = CORTE;
    expect(await hasCompensationOverrideColumn()).toBe(true);
    const tras = consultas;
    // Sin caducidad que esperar: la siguiente llamada vuelve a sondear.
    respuesta = EXISTE;
    expect(await hasCompensationOverrideColumn()).toBe(true);
    expect(consultas).toBeGreaterThan(tras);
  });

  it("las llamadas concurrentes comparten una sola consulta", async () => {
    const hasCompensationOverrideColumn = await sondaLimpia();
    respuesta = FALTA;
    const [a, b, c] = await Promise.all([
      hasCompensationOverrideColumn(),
      hasCompensationOverrideColumn(),
      hasCompensationOverrideColumn(),
    ]);
    expect([a, b, c]).toEqual([false, false, false]);
    expect(consultas).toBe(1);
  });
});
