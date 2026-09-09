import { describe, expect, it } from "vitest";
import { chunkList, IN_FILTER_CHUNK } from "@/server/services/supabase-helpers";

/**
 * El «reemplazar censo» borraba en una sola llamada, con todos los
 * identificadores dentro del filtro `in`. Ese filtro viaja en la URL: con el
 * censo entero de golpe se pasa de largo, la petición vuelve con error, el
 * borrado no se hace **en absoluto** y solo queda un aviso. El censo se
 * reemplazaba a medias sin que nadie lo viera.
 *
 * El repositorio ya tenía la respuesta —`chunkList` con tramos de
 * `IN_FILTER_CHUNK`, que usan todas las lecturas—; este camino no la usaba.
 */

describe("el filtro `in` del censo va troceado", () => {
  it("un censo grande se parte en tramos del tamaño acordado", () => {
    const censo = Array.from({ length: 1_250 }, (_, i) => `ref-${i}`);
    const tramos = chunkList(censo, IN_FILTER_CHUNK);
    expect(tramos.length).toBe(Math.ceil(1_250 / IN_FILTER_CHUNK));
    expect(tramos.every((t) => t.length <= IN_FILTER_CHUNK)).toBe(true);
    expect(tramos.flat()).toEqual(censo);
  });

  it("un censo pequeño sigue yendo en una sola llamada", () => {
    const censo = ["ref-1", "ref-2"];
    expect(chunkList(censo, IN_FILTER_CHUNK)).toEqual([censo]);
  });

  it("una lista vacía no genera ninguna llamada", () => {
    expect(chunkList([], IN_FILTER_CHUNK)).toEqual([]);
  });

  it("el importador de jueces trocea el borrado", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/server/services/import-judges-registry.ts"),
      "utf8",
    );
    const borrado = src.slice(src.indexOf("if (deletable.length)"));
    expect(borrado).toContain("chunkList(deletable, IN_FILTER_CHUNK)");
    // Y el mensaje de Postgres ya no viaja al navegador dentro del aviso.
    expect(borrado.slice(0, borrado.indexOf("}\n"))).not.toMatch(/warnings\.push\([^)]*error\.message/);
  });
});

describe("la bandeja de soporte no se corta ni se cae con muchos tickets", () => {
  it("se lee paginada y sus lecturas por lote van troceadas", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/server/services/supabase-tickets.ts"),
      "utf8",
    );
    const bandeja = src.slice(src.indexOf("getTickets:"), src.indexOf("getTicket:"));
    // La lista solo crece, y para un admin son TODOS los tickets: sin paginar,
    // PostgREST cortaba en 1000 y los más antiguos desaparecían sin decir nada.
    expect(bandeja).toMatch(/\.range\(/);
    // Y mil identificadores dentro de un `in` pasan la URL de largo: la página
    // entera se caía justo cuando la bandeja estaba llena.
    expect(bandeja).toContain("chunkList(ids, IN_FILTER_CHUNK)");
    expect(bandeja).not.toMatch(/\.in\("ticket_id", ids\)/);
  });
});
