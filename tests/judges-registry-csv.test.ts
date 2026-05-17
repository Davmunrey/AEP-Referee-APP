import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCampeonatosCsv } from "@/lib/judges-registry/parse-csv";

const CSV_PATH = resolve(
  process.cwd(),
  "tests/fixtures/campeonatos26-sample.csv",
);

describe("parseCampeonatosCsv", () => {
  it("parses string id rows from CSV", () => {
    const text = readFileSync(CSV_PATH, "utf8");
    const { competitions, warnings } = parseCampeonatosCsv(text);
    expect(competitions.length).toBeGreaterThanOrEqual(3);
    expect(competitions[0]?.nombre).toBe("Pirineos Cup");
    expect(competitions[0]?.zona).toBe("NOROESTE");
    expect(warnings.some((w) => w.includes("tipo no reconocido"))).toBe(false);
  });
});
