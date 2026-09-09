import { describe, expect, it } from "vitest";
import { parseApiResponse } from "@/lib/api/http";
import { isApiError } from "@/lib/api/types";

/**
 * `parseApiResponse` es el embudo por el que pasa cada pantalla. Cuando la
 * respuesta no traía el sobre `{ data }` / `{ error }` —un 500 de Next sin
 * cuerpo, un HTML de error de la plataforma, una desconexión a medio JSON—
 * enseñaba «Server error (500)», «Parse error (500)» o el `statusText` de
 * HTTP: en inglés, en una aplicación que está entera en castellano, y sin
 * decir qué hacer a continuación.
 */

function respuesta(
  body: string,
  { status = 200, contentType = "application/json" }: { status?: number; contentType?: string } = {},
): Response {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

async function textoDeError(res: Response): Promise<string> {
  const out = await parseApiResponse(res);
  expect(isApiError(out)).toBe(true);
  return (out as { error: string }).error;
}

describe("lo que lee el usuario cuando la respuesta no es la esperada", () => {
  it("un 500 sin JSON no habla en inglés", async () => {
    const texto = await textoDeError(
      respuesta("<html>Internal Server Error</html>", { status: 500, contentType: "text/html" }),
    );
    expect(texto).toMatch(/servidor/i);
    expect(texto).not.toMatch(/server error/i);
  });

  it("cada situación dice qué hacer, no solo que falló", async () => {
    expect(await textoDeError(respuesta("", { status: 401, contentType: "text/plain" }))).toMatch(
      /vuelve a entrar/i,
    );
    expect(await textoDeError(respuesta("", { status: 403, contentType: "text/plain" }))).toMatch(
      /permiso/i,
    );
    expect(await textoDeError(respuesta("", { status: 429, contentType: "text/plain" }))).toMatch(
      /espera/i,
    );
    expect(await textoDeError(respuesta("", { status: 503, contentType: "text/plain" }))).toMatch(
      /no está disponible/i,
    );
  });

  it("un JSON cortado a medias tampoco", async () => {
    const texto = await textoDeError(respuesta('{"data":', { status: 200 }));
    expect(texto).toMatch(/no se pudo leer la respuesta/i);
    expect(texto).not.toMatch(/parse error/i);
  });

  it("el motivo que escribe la aplicación manda sobre el genérico", async () => {
    // Es lo que las rondas anteriores se dedicaron a que llegara hasta aquí.
    const texto = await textoDeError(
      respuesta(JSON.stringify({ error: "La tarima está aprobada." }), { status: 423 }),
    );
    expect(texto).toBe("La tarima está aprobada.");
  });

  it("un sobre de error vacío cae en el genérico, no en una cadena en blanco", async () => {
    const texto = await textoDeError(respuesta(JSON.stringify({ error: "  " }), { status: 500 }));
    expect(texto.trim()).not.toBe("");
    expect(texto).toMatch(/servidor/i);
  });

  it("una respuesta correcta sigue devolviendo los datos", async () => {
    const out = await parseApiResponse<{ id: string }>(
      respuesta(JSON.stringify({ data: { id: "evt-1" } })),
    );
    expect(isApiError(out)).toBe(false);
    expect((out as { data: { id: string } }).data).toEqual({ id: "evt-1" });
  });
});
