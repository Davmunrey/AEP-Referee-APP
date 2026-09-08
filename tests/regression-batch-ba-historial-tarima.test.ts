import { describe, expect, it } from "vitest";
import { rosterHistoryView } from "@/lib/roster-history-view";

const entrada = { id: "hist-1" };

describe("qué enseña el panel de historial", () => {
  it("un fallo de lectura no se pinta como «sin cambios registrados»", () => {
    // Ese texto es una afirmación sobre el acta —«aquí no ha tocado nadie
    // nada»—, no sobre la petición que falló. Antes el catch hacía
    // `setEntries([])` y salía exactamente eso.
    expect(rosterHistoryView({ loading: false, error: true, entries: null })).toBe("error");
    expect(rosterHistoryView({ loading: false, error: true, entries: [] })).toBe("error");
  });

  it("el acta vacía de verdad sí se dice", () => {
    expect(rosterHistoryView({ loading: false, error: false, entries: [] })).toBe("vacio");
  });

  it("la primera carga enseña «cargando»", () => {
    expect(rosterHistoryView({ loading: true, error: false, entries: null })).toBe("cargando");
  });

  it("una recarga mantiene a la vista lo ya cargado en vez de parpadear", () => {
    expect(rosterHistoryView({ loading: true, error: false, entries: [entrada] })).toBe("lista");
  });

  it("sin datos y sin error todavía no hay nada que afirmar", () => {
    expect(rosterHistoryView({ loading: false, error: false, entries: null })).toBe("cargando");
  });
});
