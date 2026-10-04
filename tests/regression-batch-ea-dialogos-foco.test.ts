import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Los diálogos no atrapaban el foco: el tabulador salía a los botones de la
// página de detrás y, al cerrar, el foco caía al principio de la página.

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("diálogos modales", () => {
  it("el hook común atrapa el foco, lo devuelve y bloquea el scroll", () => {
    const src = readFileSync("src/hooks/use-escape-close.ts", "utf8");
    expect(src).toContain('e.key !== "Tab"');
    expect(src).toContain("previouslyFocused.focus()");
    expect(src).toContain('document.body.style.overflow = "hidden"');
    // El que abrió se anota en el render, antes de que un autoFocus lo pise.
    expect(src).toContain("openerRef.current =");
  });

  it("todo diálogo con velo usa el hook común (o el shell de importación, que trae el suyo)", () => {
    const sinTrampa = tsxFiles("src/components").filter((f) => {
      const s = readFileSync(f, "utf8");
      return s.includes("fixed inset-0 z-50") && !s.includes("useEscapeClose") && !f.endsWith("transfer-dialog-shell.tsx");
    });
    expect(sinTrampa).toEqual([]);
  });
});
