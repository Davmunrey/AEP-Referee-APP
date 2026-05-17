import type { JudgesRegistryImportPreview } from "@/lib/types";
import type { ParsedJudgesRegistry } from "./parse-xlsx";

export function buildJudgesRegistryImportPreview(
  parsed: Pick<ParsedJudgesRegistry, "referees" | "competitions" | "warnings">,
  filename: string,
  replaceRequested: boolean,
): JudgesRegistryImportPreview {
  return {
    filename,
    refereeCount: parsed.referees.length,
    competitionCount: parsed.competitions.length,
    warnings: parsed.warnings,
    sampleReferees: parsed.referees.slice(0, 5).map((r) => ({
      nombre: r.nombre,
      zona: r.zona,
      nivel: r.nivel,
    })),
    replaceRequested,
  };
}
