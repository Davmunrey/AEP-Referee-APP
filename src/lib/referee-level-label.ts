import type { RefereeLevel } from "@/lib/types";

/** Etiqueta corta de nivel para espacios reducidos (tarima). */
export function abbreviateRefereeLevel(level: RefereeLevel): string {
  switch (level) {
    case "Regional":
      return "R";
    case "Nacional":
      return "N";
    case "IPF Cat. 1":
      return "I";
    case "IPF Cat. 2":
      return "II";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}
