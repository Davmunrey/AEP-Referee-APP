import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD = join(process.cwd(), "src/app/(dashboard)");

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pageFiles(full));
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

// Una página que entrega el objeto entero del juez al componente cliente.
const RAW_PROP = /(?:initialReferees|referees|referee)=\{(?:referees|referee)\}/;
const LOADS_REFEREES = /dataService\.(?:getReferees|getJudgeProfile)\(/;

describe("el recorte de PII también vale para las páginas, no solo para la API", () => {
  // El recorte por rol vivía únicamente en las rutas `/api/v1/referees`, pero
  // quien entrega el censo al navegador es la página: `solo_ver` recibía email,
  // teléfono, domicilio, coordenadas y notas de cada juez en la carga inicial,
  // y la ficha del juez los pintaba directamente.
  const pages = pageFiles(DASHBOARD);

  it("hay páginas del panel que cargan jueces (el barrido encuentra algo)", () => {
    expect(pages.filter((p) => LOADS_REFEREES.test(readFileSync(p, "utf8"))).length)
      .toBeGreaterThan(3);
  });

  it("ninguna pasa el juez en crudo al cliente sin recortarlo", () => {
    const offenders = pages.filter((path) => {
      const src = readFileSync(path, "utf8");
      if (!LOADS_REFEREES.test(src)) return false;
      if (src.includes("stripReferee")) return false;
      // Sin recorte solo vale proyectar los campos no sensibles
      // (`referees.map((r) => ({ id: r.id, nombre: r.nombre }))`).
      return RAW_PROP.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("la ficha del juez recorta antes de pintar teléfono, email y notas", () => {
    const src = readFileSync(join(DASHBOARD, "referees/[id]/page.tsx"), "utf8");
    const strip = src.indexOf("stripRefereePII(");
    expect(strip).toBeGreaterThan(-1);
    // El recorte va antes del primer uso de la ficha en el marcado.
    expect(strip).toBeLessThan(src.indexOf("referee.telefono"));
  });
});
