import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_BASE_PATH } from "@/lib/api/config";
import { api } from "@/lib/api/client";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("las URLs que van dentro del HTML no pueden depender de dónde se rendericen", () => {
  // `getApiBaseUrl()` devuelve una URL absoluta distinta en el servidor y en el
  // navegador. React no repara los atributos que no cuadran al hidratar, así
  // que el enlace se quedaba con el del servidor: en local, el puerto
  // equivocado; en un despliegue sin NEXT_PUBLIC_API_URL, un localhost:3000
  // servido a todo el mundo.
  it("el enlace de exportación de analítica es relativo", () => {
    expect(api.analyticsExportUrl()).toBe(`${API_BASE_PATH}/analytics/export`);
    expect(api.analyticsExportUrl().startsWith("/")).toBe(true);
  });

  it("ningún atributo del HTML se construye con getApiBaseUrl()", () => {
    const offenders: string[] = [];
    for (const dir of ["src/components", "src/app"]) {
      for (const path of sourceFiles(join(process.cwd(), dir))) {
        const src = readFileSync(path, "utf8");
        // href/src/action con la base absoluta dentro, en la misma línea.
        for (const [i, line] of src.split(/\r?\n/).entries()) {
          if (/(href|src|action)=\{[^}]*getApiBaseUrl\(\)/.test(line)) {
            offenders.push(`${path.replace(process.cwd() + "/", "")}:${i + 1}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
