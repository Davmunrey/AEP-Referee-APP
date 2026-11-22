import { describe, expect, it } from "vitest";
import { optionalTables, requiredTables } from "../scripts/lib/backup-tables.mjs";
import { tablasVivas } from "../scripts/lib/migration-tables.mjs";

describe("tablas de la copia de seguridad", () => {
  const copiadas = new Set<string>([...requiredTables, ...optionalTables]);

  it("cubre todas las tablas que las migraciones dejan vivas", () => {
    const fuera = (tablasVivas() as string[]).filter((t) => !copiadas.has(t));
    expect(fuera).toEqual([]);
  });

  it("incluye las que ya se quedaron fuera una vez", () => {
    for (const t of [
      "judge_compensation_claims",
      "convocatorias",
      "convocatoria_inscripciones",
      "designacion_respuestas",
      "notificaciones",
    ]) {
      expect(copiadas.has(t)).toBe(true);
    }
  });

  it("no copia tablas que una migración posterior borró", () => {
    expect(copiadas.has("device_tokens")).toBe(false);
    expect(copiadas.has("referee_availability")).toBe(false);
  });

  it("las obligatorias existen de verdad en las migraciones", () => {
    const vivas = new Set(tablasVivas() as string[]);
    expect((requiredTables as string[]).filter((t) => !vivas.has(t))).toEqual([]);
  });
});
