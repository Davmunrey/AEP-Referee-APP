import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  higherRefereeLevels,
  isRefereeLevelUpgrade,
  meetsRefereeLevel,
  refereeLevelRank,
  REFEREE_LEVEL_ORDER,
} from "@/lib/referee-levels";
import { REFEREE_LEVELS } from "@/app/api/_lib/validation";
import { LEVELS } from "@/lib/mock-data";

describe("el escalafón de niveles", () => {
  it("va de menor a mayor, con IPF Cat. 1 en la cima", () => {
    expect([...REFEREE_LEVEL_ORDER]).toEqual([
      "Regional",
      "Nacional",
      "IPF Cat. 2",
      "IPF Cat. 1",
    ]);
    expect(refereeLevelRank("IPF Cat. 1")).toBeGreaterThan(refereeLevelRank("IPF Cat. 2"));
  });

  it("un nivel ilegible no llega a ningún mínimo ni cuenta como ascenso", () => {
    // Con `indexOf` sobre copias locales, un nivel ilegible daba -1 y
    // cualquier destino contaba como ascenso: se «ascendía» a Regional a un
    // juez cuyo nivel la aplicación no sabía leer.
    expect(refereeLevelRank("Autonómico")).toBe(-1);
    expect(meetsRefereeLevel("Autonómico", "Regional")).toBe(false);
    expect(isRefereeLevelUpgrade("Autonómico", "Regional")).toBe(false);
    expect(isRefereeLevelUpgrade("Nacional", "Autonómico")).toBe(false);
    expect(higherRefereeLevels("Autonómico")).toEqual([]);
  });

  it("subir sí es subir, y bajar no", () => {
    expect(isRefereeLevelUpgrade("Regional", "Nacional")).toBe(true);
    expect(isRefereeLevelUpgrade("IPF Cat. 2", "IPF Cat. 1")).toBe(true);
    expect(isRefereeLevelUpgrade("IPF Cat. 1", "IPF Cat. 2")).toBe(false);
    expect(isRefereeLevelUpgrade("Nacional", "Nacional")).toBe(false);
  });

  it("la lista de validación de la API ya no está en otro orden", () => {
    // Tenía «IPF Cat. 1» antes que «IPF Cat. 2». Como conjunto daba igual,
    // pero se llama casi igual que el escalafón y parece la lista canónica:
    // quien la reutilizara para ordenar invertía la cima.
    expect([...REFEREE_LEVELS]).toEqual([...REFEREE_LEVEL_ORDER]);
    expect(LEVELS).toEqual([...REFEREE_LEVEL_ORDER]);
  });
});

describe("y nadie vuelve a copiarlo a mano", () => {
  function ficheros(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...ficheros(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("solo `referee-levels` escribe la escalera entera", () => {
    // Estaba copiada a mano en nueve sitios. Mientras las nueve coincidan no
    // pasa nada; el día que una se quede atrás, un ascenso se aprueba y el
    // nivel no sube — o peor, un cambio se toma por ascenso y degrada al juez.
    const copias = ficheros(join(process.cwd(), "src"))
      .filter((p) => !p.endsWith(join("lib", "referee-levels.ts")))
      .filter((p) =>
        /["']Regional["'],\s*["']Nacional["'],\s*["']IPF Cat\. [12]["']/.test(
          readFileSync(p, "utf8"),
        ),
      );
    expect(copias.map((p) => p.replace(process.cwd() + "/", ""))).toEqual([]);
  });
});
