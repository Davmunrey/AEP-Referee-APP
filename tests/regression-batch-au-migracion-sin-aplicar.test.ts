import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMissingTableError, warnMissingMigration } from "@/server/services/supabase-helpers";

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe("una migración sin aplicar deja de degradar en silencio", () => {
  // La aplicación degrada a propósito cuando falta una columna o una tabla:
  // sigue con el esquema viejo en vez de reventar. Lo hacía en absoluto
  // silencio, así que una migración que nunca llegó a la base —el workflow que
  // las aplica puede fallar sin que nadie mire— podía pasar meses sin que nada
  // lo dijera.
  it("avisa una vez, con qué falta y dónde mirar", () => {
    warnMissingMigration("tabla_de_prueba_au");
    expect(warn).toHaveBeenCalledTimes(1);
    const mensaje = String(warn.mock.calls[0]?.[0]);
    expect(mensaje).toContain("tabla_de_prueba_au");
    expect(mensaje).toContain("migraciones sin aplicar");
    expect(mensaje).toMatch(/Migraciones Supabase/);
  });

  it("no repite el aviso del mismo hueco en el mismo proceso", () => {
    warnMissingMigration("tabla_repetida_au");
    warnMissingMigration("tabla_repetida_au");
    warnMissingMigration("tabla_repetida_au");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("la tabla ausente que toleran las guardas de borrado también avisa", () => {
    expect(isMissingTableError({ code: "42P01", message: "relation does not exist" })).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("un fallo de red no se confunde con una migración pendiente", () => {
    expect(isMissingTableError({ message: "connection reset" })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
