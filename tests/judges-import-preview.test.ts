import { describe, expect, it } from "vitest";
import { buildJudgesRegistryImportPreview } from "@/lib/judges-registry";

describe("buildJudgesRegistryImportPreview", () => {
  it("builds preview payload with sample cap and replace flag", () => {
    const referees = Array.from({ length: 8 }, (_, i) => ({
      nombre: `Juez ${i}`,
      zona: "CENTRO",
      nivel: "Regional" as const,
    }));

    const preview = buildJudgesRegistryImportPreview(
      {
        referees,
        competitions: [],
        warnings: ["fila omitida"],
      },
      "Control jueces.xlsx",
      true,
    );

    expect(preview.filename).toBe("Control jueces.xlsx");
    expect(preview.refereeCount).toBe(8);
    expect(preview.competitionCount).toBe(0);
    expect(preview.warnings).toEqual(["fila omitida"]);
    expect(preview.sampleReferees).toHaveLength(5);
    expect(preview.replaceRequested).toBe(true);
  });
});
