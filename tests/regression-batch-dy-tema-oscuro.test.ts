import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  themeBootScript,
} from "@/lib/theme";

describe("tema claro / oscuro", () => {
  it("resuelve la preferencia contra el sistema", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("solo acepta las tres preferencias conocidas", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("el script de arranque es JavaScript válido y usa la misma clave", () => {
    expect(() => new Function(themeBootScript)).not.toThrow();
    expect(themeBootScript).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it("los tokens definen el tema oscuro por atributo y por preferencia del sistema", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    // Los dos bloques deben llevar los mismos tokens.
    const bloque = (inicio: string) => {
      const i = css.indexOf(inicio);
      return css.slice(i, css.indexOf("}", i)).match(/--[\w-]+:/g)?.sort();
    };
    expect(bloque(':root[data-theme="dark"]')).toEqual(bloque(":root:not([data-theme])"));
  });
});
