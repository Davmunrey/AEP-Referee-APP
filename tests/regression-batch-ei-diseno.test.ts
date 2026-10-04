import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { confirmar, currentConfirm, settleConfirm, subscribeConfirm } from "@/lib/confirm-store";
import { coverageBarClass, STATUS_BAR } from "@/lib/status-tone";
import { formatDate } from "@/lib/utils";

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
    expect(STATUS_BAR.Completo).toBe("bg-success");
    expect(coverageBarClass(100)).toBe("bg-success");
    expect(coverageBarClass(0)).toBe("bg-subtle");
    expect(coverageBarClass(33)).toBe("bg-destructive");
    expect(coverageBarClass(75)).toBe("bg-warning");
  });
});

describe("fechas", () => {
  it("un día suelto se escribe como en el resto de la interfaz", () => {
    expect(formatDate("2026-10-25")).toMatch(/^25 oct\.? 2026$/);
  });
});
