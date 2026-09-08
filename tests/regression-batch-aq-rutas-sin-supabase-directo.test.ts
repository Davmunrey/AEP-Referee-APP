import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API = join(process.cwd(), "src/app/api/v1");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

/**
 * Rutas que hablan con Supabase a propósito: sesión, cuentas y contraseñas van
 * por la Admin API de GoTrue, que no tiene equivalente en el backend en
 * memoria. Cualquier otra ruta sirve datos de la aplicación y tiene que
 * pedirlos al `dataService`, que es quien elige backend.
 */
const SOLO_SUPABASE = new Set([
  "admin/users/route.ts",
  "admin/users/[id]/route.ts",
  "admin/users/[id]/password/route.ts",
  "auth/change-password/route.ts",
  "auth/login/route.ts",
  "auth/logout/route.ts",
  "auth/signout/route.ts",
]);

describe("las rutas de datos no pueden atarse a Supabase", () => {
  // El cuadrante imprimible pedía los nombres con `createAdminClient()` a pelo:
  // sin SUPABASE_SERVICE_ROLE_KEY —el modo de desarrollo y el de las capturas—
  // la ruta reventaba con un 500 en vez de imprimir la tarima.
  it("solo las rutas de cuentas usan el cliente de Supabase directamente", () => {
    const offenders = routeFiles(API)
      .filter((path) => /createAdminClient|@\/lib\/supabase\/(admin|server)/.test(readFileSync(path, "utf8")))
      .map((path) => path.replace(API + "/", ""))
      .filter((rel) => !SOLO_SUPABASE.has(rel));
    expect(offenders).toEqual([]);
  });
});
