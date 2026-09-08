import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRouteError } from "@/lib/api/route-utils";
import {
  ApprovalReviewError,
  CompensationSyncError,
  PromotionReviewError,
  UserFacingServiceError,
} from "@/lib/competitions/service-types";

const API = join(process.cwd(), "src/app/api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

describe("ninguna ruta deja escapar una excepción", () => {
  // Sin `try/catch`, Next devuelve un 500 sin cuerpo JSON. El cliente espera
  // el sobre `{ data }` / `{ error }`, no lo encuentra y acaba enseñando
  // «Server error (500)» —en inglés, en una aplicación en castellano— en vez
  // del mensaje que la propia aplicación tenía escrito.
  it("toda ruta que llama al servicio atrapa lo que pueda lanzar", () => {
    const sinCatch = routeFiles(API).filter((path) => {
      const src = readFileSync(path, "utf8");
      return src.includes("dataService.") && !src.includes("catch");
    });
    expect(sinCatch.map((p) => p.replace(process.cwd() + "/", ""))).toEqual([]);
  });

  it("y ningún `catch` vuelve a soltar la excepción por la puerta de atrás", () => {
    // Tener `catch` no basta: varios atrapaban solo sus errores de negocio y
    // remataban con `throw err`, que sale igual de Next como un 500 sin cuerpo.
    const conRelanzamiento = routeFiles(API).filter((path) =>
      /\bthrow\s+(err|error|e)\b\s*;/.test(readFileSync(path, "utf8")),
    );
    expect(conRelanzamiento.map((p) => p.replace(process.cwd() + "/", ""))).toEqual([]);
  });
});

describe("un permiso, un sitio donde cambiarlo", () => {
  // La pantalla escondía el botón con `canImportCalendar` y la ruta lo
  // comprobaba a mano con `role !== "super_admin" && role !== "delegado_jueces"`.
  // Mientras coincidan no pasa nada; el día que uno cambie, la interfaz y la
  // API dejarán de decir lo mismo sobre quién puede importar.
  it("ninguna ruta reimplementa el predicado «administración nacional»", () => {
    const aMano = routeFiles(API).filter((path) =>
      /role\s*!==\s*"super_admin"\s*&&[\s\S]{0,40}role\s*!==\s*"delegado_jueces"/.test(
        readFileSync(path, "utf8"),
      ),
    );
    expect(aMano.map((p) => p.replace(process.cwd() + "/", ""))).toEqual([]);
  });
});

describe("jsonRouteError separa el motivo del usuario del fallo de infraestructura", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("el motivo escrito para el usuario sale con su texto y su código", async () => {
    const res = jsonRouteError(
      "x",
      new ApprovalReviewError("La revisión se guardó, pero el campeonato no llegó a marcarse."),
      "genérico",
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/no llegó a marcarse/);
  });

  it("cada tipo trae su propio código", () => {
    expect(new PromotionReviewError("x").status).toBe(409);
    // Reintentar es lo sensato cuando los conceptos quedaron a medias.
    expect(new CompensationSyncError("x").status).toBe(503);
    expect(new UserFacingServiceError("x", 423).status).toBe(423);
  });

  it("un fallo de infraestructura sale genérico y sin texto de Postgres", async () => {
    const res = jsonRouteError(
      "roster.GET",
      new Error('relation "roster_assignments" does not exist'),
      "No se pudo cargar la tarima",
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("No se pudo cargar la tarima");
    expect(JSON.stringify(body)).not.toMatch(/roster_assignments|relation/);
    expect(console.error).toHaveBeenCalled();
  });
});
