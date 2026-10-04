import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { confirmar, currentConfirm, settleConfirm, subscribeConfirm } from "@/lib/confirm-store";
import { coverageBarClass, STATUS_BAR } from "@/lib/status-tone";
import { BRAND } from "@/lib/document-tokens";
import { cn, formatDate } from "@/lib/utils";

/**
 * Auditoría de diseño (v2.12): reglas de la casa que no deben volver.
 * Se comprueban sobre el código fuente porque son decisiones de interfaz que
 * ningún test de comportamiento vería desaparecer.
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

// Sin comentarios: explicar por qué ya no se usa `alert()` no es usarlo.
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sources = tsxFiles("src").map((path) => ({ path, text: stripComments(readFileSync(path, "utf8")) }));

describe("diseño: reglas de la casa", () => {
  it("ninguna pantalla usa el confirm/alert del navegador", () => {
    const offenders = sources
      .filter(({ path }) => !path.endsWith("confirm-dialog.tsx"))
      .filter(({ text }) => /window\.confirm\(|[^.\w]confirm\(|\balert\(/.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("los títulos de página no llevan rótulo encima", () => {
    const offenders = sources.filter(({ text }) => /\beyebrow=/.test(text)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("las cifras no llevan icono en un cuadrado de color", () => {
    const offenders = sources.filter(({ text }) => /<MetricTile[^>]*\bicon=/.test(text)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("los velos de los modales usan el token, no negro suelto", () => {
    const offenders = sources.filter(({ text }) => /bg-black\/\d+/.test(text)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("sin bandas laterales de color en tarjetas ni chips", () => {
    const offenders = sources
      .filter(({ text }) => /border-[lr]-(?:[2-9]|\[[2-9]px\])/.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});

describe("todo tokenizado", () => {
  const rules: Array<[string, RegExp]> = [
    ["tamaño de letra suelto (usa text-2xs, text-ui, text-title, text-heading, text-display…)", /\btext-\[\d+(?:\.\d+)?px\]/],
    ["capa con número (usa z-(--z-…))", /\bz-\[\d+\]|(?<![\w-])z-[1-9]0\b/],
    ["espaciado de letra suelto (usa tracking-tighter/tight/snug)", /\btracking-\[/],
    ["duración con número (usa duration-(--duration-…))", /\bduration-\d+\b/],
    ["escala suelta (usa scale-(--scale-…))", /\bscale-\[/],
  ];
  // También los .ts: las clases de movimiento compartidas viven en motion.ts.
  const ts = (function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return path.endsWith(".ts") ? [path] : [];
    });
  })("src").map((path) => ({ path, text: stripComments(readFileSync(path, "utf8")) }));
  for (const [label, pattern] of rules) {
    it(`sin ${label}`, () => {
      expect([...sources, ...ts].filter(({ text }) => pattern.test(text)).map(({ path }) => path)).toEqual([]);
    });
  }
});

describe("confirmar()", () => {
  it("sin anfitrión montado ni navegador, no confirma nada", async () => {
    await expect(confirmar({ titulo: "¿Eliminar?", peligro: true })).resolves.toBe(false);
  });

  it("con el diálogo montado, espera a la respuesta", async () => {
    const unsubscribe = subscribeConfirm(() => {});
    try {
      const respuesta = confirmar({ titulo: "¿Vaciar asignaciones?", accion: "Vaciar asignaciones", peligro: true });
      expect(currentConfirm()?.accion).toBe("Vaciar asignaciones");
      settleConfirm(true);
      await expect(respuesta).resolves.toBe(true);
      expect(currentConfirm()).toBeNull();
    } finally {
      unsubscribe();
    }
  });

  it("una confirmación nueva cancela la que estaba abierta", async () => {
    const unsubscribe = subscribeConfirm(() => {});
    try {
      const primera = confirmar({ titulo: "Primera" });
      const segunda = confirmar({ titulo: "Segunda" });
      await expect(primera).resolves.toBe(false);
      settleConfirm(true);
      await expect(segunda).resolves.toBe(true);
    } finally {
      unsubscribe();
    }
  });
});

describe("tono de cobertura", () => {
  it("una tarima completa es verde, no rojo de marca", () => {
    expect(STATUS_BAR.Completo).toBe("bg-chart-success");
    expect(coverageBarClass(100)).toBe("bg-chart-success");
    expect(coverageBarClass(0)).toBe("bg-subtle");
    expect(coverageBarClass(33)).toBe("bg-chart-danger");
    expect(coverageBarClass(75)).toBe("bg-chart-warning");
  });
});

describe("fechas", () => {
  it("un día suelto se escribe como en el resto de la interfaz", () => {
    expect(formatDate("2026-10-25")).toMatch(/^25 oct\.? 2026$/);
  });
});

describe("tokens de documentos", () => {
  it("la marca de correos y PDF es la misma que la de la app", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    const primitive = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1]?.toLowerCase();
    expect(BRAND.red).toBe(primitive("aep-red-600"));
    expect(BRAND.redSoft).toBe(primitive("aep-red-100"));
    expect(BRAND.ink).toBe(primitive("neutral-900"));
    expect(BRAND.muted).toBe(primitive("neutral-500"));
    expect(BRAND.border).toBe(primitive("neutral-200"));
    expect(BRAND.surface).toBe(primitive("neutral-50"));
    expect(BRAND.paper).toBe(primitive("neutral-0"));
  });

  it("ningún color suelto fuera de los ficheros de tokens", () => {
    const allowed = new Set(["src/styles/tokens.css", "src/lib/document-tokens.ts"]);
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.(tsx?|css)$/.test(path) ? [path] : [];
      });
    })("src");
    const offenders = files
      .filter((path) => !allowed.has(path))
      .filter((path) => /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b(?![0-9a-z-])|rgba?\(|hsla?\(|oklch\(/i.test(stripComments(readFileSync(path, "utf8"))));
    expect(offenders).toEqual([]);
  });
});

describe("cn() con la escala propia", () => {
  it("un tamaño de la escala no borra el color del texto", () => {
    expect(cn("bg-primary text-primary-foreground", "text-ui")).toBe("bg-primary text-primary-foreground text-ui");
    expect(cn("text-2xs text-muted-foreground", "text-success")).toBe("text-2xs text-success");
  });

  it("dos tamaños sí se sustituyen", () => {
    expect(cn("text-sm", "text-ui")).toBe("text-ui");
    expect(cn("text-2xs", "text-title")).toBe("text-title");
    expect(cn("tracking-tight", "tracking-snug")).toBe("tracking-snug");
  });
});
