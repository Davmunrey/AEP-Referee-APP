import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";

/**
 * Parser mínimo de CHANGELOG.md para la sección «Novedades» de /docs.
 * CHANGELOG.md es la única fuente de verdad: aquí solo se trocea en versiones
 * (bloques `## `) y en líneas de párrafo/viñeta; el formato inline (negritas,
 * cursivas, enlaces) lo resuelve el componente al renderizar.
 */

export interface ChangelogBlock {
  type: "p" | "li";
  text: string;
}

export interface ChangelogVersion {
  /** Línea de cabecera tal cual (emoji + título + nombre en clave + fecha). */
  heading: string;
  blocks: ChangelogBlock[];
}

export function parseChangelog(md: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  let current: ChangelogVersion | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), blocks: [] };
      versions.push(current);
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;
    if (trimmed.startsWith("- ")) {
      current.blocks.push({ type: "li", text: trimmed.slice(2).trim() });
    } else {
      current.blocks.push({ type: "p", text: trimmed });
    }
  }
  return versions;
}

/**
 * Lectura por request con dedupe (React cache). El fichero viaja con el bundle
 * serverless vía `outputFileTracingIncludes` en next.config.ts; si por lo que
 * sea no está, la sección simplemente no se muestra (never crash /docs).
 */
export const getChangelogVersions = cache((): ChangelogVersion[] => {
  try {
    const md = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
    return parseChangelog(md);
  } catch {
    return [];
  }
});
