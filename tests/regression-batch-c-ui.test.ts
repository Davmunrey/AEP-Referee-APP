import { describe, expect, it } from "vitest";
import type { ApprovalProposal } from "@/lib/types";
import { selectedApproval } from "@/lib/approvals/select";
import { zoneFilterOptions } from "@/lib/competitions/list-filters";
import { formatTimeRange, parseTimeRange } from "@/lib/time-range";
import { swapCollapsedIndexes } from "@/components/competitions/roster-session-helpers";

// Ronda 4: lógica extraída de los componentes cliente donde se concentraban
// bugs de estado (props obsoletas, claves inestables, valores ambiguos).

describe("parseTimeRange / formatTimeRange", () => {
  it("van y vuelven sin mover las horas de sitio", () => {
    for (const [start, end] of [
      ["10:00", "13:00"],
      ["10:00", ""],
      ["", "13:00"],
      ["", ""],
    ] as const) {
      expect(parseTimeRange(formatTimeRange(start, end))).toEqual([start, end]);
    }
  });

  it("borrar la hora de inicio ya no asciende la de fin", () => {
    // Antes `set("", "13:00")` guardaba "13:00" a secas, que al releer volvía
    // como hora de INICIO: la sesión pasaba a empezar cuando debía terminar.
    expect(parseTimeRange(formatTimeRange("", "13:00"))).toEqual(["", "13:00"]);
  });

  it("normaliza a HH:MM y acepta el guion largo del Excel", () => {
    expect(parseTimeRange("9:30 – 12:00")).toEqual(["09:30", "12:00"]);
  });

  it("un horario suelto se sigue leyendo como hora de inicio", () => {
    expect(parseTimeRange("10:00")).toEqual(["10:00", ""]);
  });
});

describe("swapCollapsedIndexes", () => {
  it("el colapso viaja con la sesión que se mueve", () => {
    expect([...swapCollapsedIndexes(new Set([1]), 1, 0)]).toEqual([0]);
  });

  it("intercambia cuando ambas están colapsadas o ninguna lo está", () => {
    expect([...swapCollapsedIndexes(new Set([0, 1]), 0, 1)].sort()).toEqual([0, 1]);
    expect([...swapCollapsedIndexes(new Set([2]), 0, 1)]).toEqual([2]);
  });

  it("no toca el resto de posiciones", () => {
    expect([...swapCollapsedIndexes(new Set([0, 3]), 0, 1)].sort()).toEqual([1, 3]);
  });
});

describe("zoneFilterOptions", () => {
  it("incluye la zona del delegado aunque no tenga campeonatos", () => {
    // Si no aparecía, el `select` arrancaba con un `value` inexistente: el
    // navegador enseñaba «Todas las zonas» mientras la tabla filtraba por la
    // zona del delegado y no salía ni un campeonato.
    expect(zoneFilterOptions([], "CENTRO")).toEqual(["CENTRO"]);
  });

  it("no duplica la zona del delegado ni descoloca el orden", () => {
    const comps = [{ zona: "MEDITERRANEO" }, { zona: "CENTRO" }, { zona: "CENTRO" }];
    expect(zoneFilterOptions(comps, "CENTRO")).toEqual(["CENTRO", "MEDITERRANEO"]);
  });

  it("sin zona de usuario solo ofrece las zonas presentes", () => {
    expect(zoneFilterOptions([{ zona: "CANARIAS" }], null)).toEqual(["CANARIAS"]);
  });
});

describe("selectedApproval", () => {
  const prop = (id: string, status: ApprovalProposal["status"]) =>
    ({ id, status }) as ApprovalProposal;

  it("devuelve la propuesta viva, no la copia capturada al seleccionarla", () => {
    const items = [prop("ap-1", "aprobado"), prop("ap-2", "pendiente")];
    expect(selectedApproval(items, "ap-1")).toBe(items[0]);
    expect(selectedApproval(items, "ap-1")!.status).toBe("aprobado");
  });

  it("cae en la primera pendiente cuando la seleccionada ya no está", () => {
    const items = [prop("ap-3", "rechazado"), prop("ap-4", "pendiente")];
    expect(selectedApproval(items, "ap-borrada")!.id).toBe("ap-4");
  });

  it("sin pendientes cae en la primera de la lista y aguanta la lista vacía", () => {
    expect(selectedApproval([prop("ap-5", "aprobado")], null)!.id).toBe("ap-5");
    expect(selectedApproval([], null)).toBeNull();
  });
});
