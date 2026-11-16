import { describe, expect, it } from "vitest";
import { rosterTemplateSchema } from "@/lib/validations";
import { getPresetForEventType } from "@/lib/roster-template";

/**
 * Con zod 3, una plantilla hostil de 4,5 MB (`[{},{},…]`) obligaba a parsear
 * cada elemento aunque el array ya superase su `.max()`: 12,6 millones de
 * issues y 2,7 GB de memoria en una sola petición de cualquier editor de
 * tarima, por encima de los 2 GB de una función de Vercel. Con zod 4 y los
 * topes de `rosterTemplateSchema`, un array por encima del tope se rechaza
 * antes de mirar sus elementos: un único issue `too_big`.
 */
const minimalSession = {
  sesion: "S1",
  nombre: "Sesión 1",
  dia: "Viernes",
  categorias: [{ genero: "Hombres" as const, pesos: "83" }],
  horarioCompeticion: "09:00",
  horarioPesaje: "08:00",
  roles: [{ rol: "Central", slots: 1, key: "central" as const }],
  pesajeRoles: [],
};

describe("topes de la plantilla de tarima", () => {
  it("rechaza con un único issue una plantilla con demasiadas sesiones", () => {
    const hostil = Array.from({ length: 200_000 }, () => ({}));
    const started = performance.now();
    const result = rosterTemplateSchema.safeParse(hostil);
    const elapsed = performance.now() - started;

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]).toMatchObject({ code: "too_big", path: [] });
    expect(elapsed).toBeLessThan(500);
  });

  it("rechaza con un único issue una sesión con una lista de roles enorme", () => {
    const sesion = { ...minimalSession, roles: Array.from({ length: 200_000 }, () => ({})) };
    const result = rosterTemplateSchema.safeParse([sesion]);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]).toMatchObject({ code: "too_big", path: [0, "roles"] });
  });

  it("rechaza con un único issue un grupo con demasiadas categorías", () => {
    const sesion = {
      ...minimalSession,
      grupos: [{ nombre: "G1", categorias: Array.from({ length: 200_000 }, () => ({})) }],
    };
    const result = rosterTemplateSchema.safeParse([sesion]);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]).toMatchObject({
      code: "too_big",
      path: [0, "grupos", 0, "categorias"],
    });
  });

  it.each(["AEP-1", "AEP-2", "AEP-3"] as const)(
    "sigue aceptando el preset real %s",
    (tipo) => {
      expect(rosterTemplateSchema.safeParse(getPresetForEventType(tipo)).success).toBe(true);
    },
  );
});
