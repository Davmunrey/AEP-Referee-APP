import { describe, expect, it } from "vitest";
import { findRegulationViolation, getRecommendationWarning } from "@/lib/roster-ui";
import { REGULATION_RULES } from "@/server/store";
import type { Referee, RegulationRule } from "@/lib/types";

const juez = (nivel: Referee["nivel"]): Referee =>
  ({
    id: "j1",
    nombre: "Ana Ruiz",
    zona: "CENTRO",
    nivel,
    estado: "Activo",
    disp: true,
    eventos: 0,
    ultimo: "—",
  }) as Referee;

const normativa = REGULATION_RULES as RegulationRule[];

describe("la normativa que la aplicación enseña es la que aplica", () => {
  it("un Regional de Juez Central incumple la regla que la propia app publica", () => {
    // `findRegulationViolation` empezaba con `if (roleKey !== "jurado") return
    // undefined`, así que de toda la tabla solo se consultaba una fila. La
    // regla «Juez Central: mínimo Nacional» estaba sembrada, se enseña en
    // /regulations… y no producía ningún aviso.
    const regla = findRegulationViolation("central", "AEP-1", "Regional", normativa);
    expect(regla?.rol).toBe("Juez Central");
    expect(getRecommendationWarning(juez("Regional"), "central", "AEP-1", normativa)).toMatch(
      /Nacional/,
    );
  });

  it("el mismo juez con el nivel exigido no genera aviso", () => {
    expect(findRegulationViolation("central", "AEP-1", "Nacional", normativa)).toBeUndefined();
    expect(
      getRecommendationWarning(juez("Nacional"), "central", "AEP-1", normativa),
    ).toBeNull();
  });

  it("el jurado, que era el único caso vivo, sigue funcionando igual", () => {
    expect(
      getRecommendationWarning(juez("Nacional"), "jurado", "AEP-1", normativa),
    ).toMatch(/IPF Cat\. 2/);
  });

  it("una regla que no cubre este tipo de campeonato no se aplica", () => {
    // reg-03 (Jurado) solo vale para AEP-1: en AEP-2 no hay fila que incumplir.
    const regla = findRegulationViolation("jurado", "AEP-2", "Regional", normativa);
    expect(regla).toBeUndefined();
  });

  it("sin normativa legible queda el mínimo por defecto, no el silencio", () => {
    // Antes, con la tabla vacía —degradado, error de lectura— no quedaba ni un
    // aviso en toda la tarima salvo para «jurado».
    expect(getRecommendationWarning(juez("Regional"), "central", "AEP-1", [])).toMatch(
      /Nacional/,
    );
    expect(getRecommendationWarning(juez("Regional"), "mesa", "AEP-1", [])).toBeNull();
  });
});
