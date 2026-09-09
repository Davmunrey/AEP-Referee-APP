import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  esRetornoSinAcceso,
  SIGN_IN_SIN_ACCESO,
  SIN_ACCESO_PARAM,
  SIN_ACCESO_VALUE,
} from "@/lib/auth/sign-in-redirect";

/**
 * Dos redirecciones que se perseguían:
 *
 *  - el middleware manda a `/` a quien trae cookie de auth válida;
 *  - el layout del panel manda a `/sign-in` a quien no tiene perfil ACTIVO.
 *
 * Una cuenta autenticada pero inactiva cumple las dos a la vez. El navegador
 * cortaba con ERR_TOO_MANY_REDIRECTS, sin una sola palabra sobre lo que pasaba.
 * Y desde que el alta por cuenta propia nace siempre inactiva, ese es el
 * camino normal de cualquiera que se registre.
 */

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

function readdirRecursivo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const ruta = join(dir, entry.name);
    if (entry.isDirectory()) return readdirRecursivo(ruta);
    return entry.name.endsWith(".tsx") ? [ruta] : [];
  });
}

describe("la marca de «cuenta sin acceso»", () => {
  it("el destino lleva el parámetro que el middleware reconoce", () => {
    const url = new URL(SIGN_IN_SIN_ACCESO, "https://ejemplo.test");
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get(SIN_ACCESO_PARAM)).toBe(SIN_ACCESO_VALUE);
    expect(esRetornoSinAcceso(url.searchParams)).toBe(true);
  });

  it("una visita normal a /sign-in no lleva la marca", () => {
    expect(esRetornoSinAcceso(new URLSearchParams())).toBe(false);
    expect(esRetornoSinAcceso(new URLSearchParams({ estado: "otra-cosa" }))).toBe(false);
    expect(esRetornoSinAcceso(new URLSearchParams({ error: "x" }))).toBe(false);
  });
});

describe("las dos puntas de la redirección siguen atadas", () => {
  it("el rebote de «ya estás dentro» consulta la marca antes de rebotar", () => {
    const middleware = leer("src/lib/supabase/middleware.ts");
    const condicion = middleware.slice(
      middleware.indexOf("const vuelveSinAcceso"),
      middleware.indexOf('pathname === "/login"'),
    );
    expect(condicion).toContain("esRetornoSinAcceso");
    expect(condicion).toContain("!vuelveSinAcceso");
  });

  it("ninguna página del panel manda ya a /sign-in a secas", () => {
    // Eran 18 copias del mismo `if (!user) redirect("/sign-in")`. Bastaba con
    // que una se quedara atrás para que esa pantalla siguiera en bucle.
    const paginas = readdirRecursivo(join(raiz, "src/app/(dashboard)"));
    expect(paginas.length).toBeGreaterThan(10);
    for (const fichero of paginas) {
      const src = readFileSync(fichero, "utf8");
      if (!src.includes("redirect(")) continue;
      expect(src, fichero).not.toMatch(/redirect\("\/sign-in"\)/);
    }
  });

  it("la pantalla de acceso explica por qué no se entra", () => {
    const page = leer("src/app/sign-in/[[...sign-in]]/page.tsx");
    expect(page).toContain("SIN_ACCESO_PARAM");
    expect(page).toMatch(/todavía no tiene acceso al panel/);
  });
});
