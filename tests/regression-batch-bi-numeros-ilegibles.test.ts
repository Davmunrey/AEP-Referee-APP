import { describe, expect, it } from "vitest";
import {
  mapCompensationClaimRow,
  mapCompensationDutyLine,
  mapCompetition,
  mapReferee,
} from "@/server/db/mappers";
import { formatReceiptAmountEur } from "@/lib/judge-compensation/receipt-document";

/**
 * Segunda ronda de datos degradados. La primera (`regression-batch-p`) cubrió
 * el JSONB con forma inesperada; esta cubre las columnas escalares: un texto
 * nulo que se imprimía como «null» y un número ilegible que se convertía en
 * NaN y no se quedaba quieto.
 */

describe("un texto nulo no se imprime como «null»", () => {
  it("en la ficha del juez", () => {
    // `String(null)` da el literal «null», y eso acababa en el cuadrante
    // impreso como si fuera el nombre del juez.
    const r = mapReferee({ id: "j1", nombre: null, zona: null, iniciales: null, disp: true });
    expect(r.nombre).toBe("");
    expect(r.zona).toBe("");
    expect(r.iniciales).toBe("");
    expect(r.ultimo).toBe("—");
  });

  it("en el campeonato", () => {
    const c = mapCompetition({ id: "c1", nombre: null, sede: null, fecha: null, tipo: "AEP-2" });
    expect(c.nombre).toBe("");
    expect(c.sede).toBe("");
    expect(c.fecha).toBe("");
  });

  it("y un texto de verdad se respeta", () => {
    const r = mapReferee({ id: "j1", nombre: "Ana Ruiz", zona: "CENTRO", ultimo: "2026-03-01" });
    expect(r.nombre).toBe("Ana Ruiz");
    expect(r.ultimo).toBe("2026-03-01");
  });
});

describe("un número ilegible no se convierte en NaN", () => {
  it("los contadores de la ficha del juez", () => {
    // `eventos` entra en las sumas de la analítica: un NaN se lleva por
    // delante el total entero, no solo su fila.
    expect(mapReferee({ id: "j1", eventos: "muchos" }).eventos).toBe(0);
    expect(mapReferee({ id: "j1", eventos: null }).eventos).toBe(0);
    expect(mapReferee({ id: "j1", eventos: 7 }).eventos).toBe(7);
  });

  it("unas coordenadas ilegibles son ausencia de coordenadas", () => {
    // Con NaN, el domicilio parecía geocodificado y la ruta a la sede salía
    // sin sentido —y de ahí salen los km que se pagan.
    const r = mapReferee({ id: "j1", domicilio_lat: "x", domicilio_lng: "y" });
    expect(r.domicilioLat).toBeUndefined();
    expect(r.domicilioLng).toBeUndefined();
  });

  it("las plazas y la cobertura del campeonato", () => {
    const c = mapCompetition({ id: "c1", sesiones: "tres", requeridos: null, confirmados: "x" });
    expect(c.sesiones).toBe(0);
    expect(c.requeridos).toBe(0);
    expect(c.confirmados).toBe(0);
  });

  it("los importes de la liquidación", () => {
    const c = mapCompensationClaimRow({
      id: "cmp-1",
      competition_id: "c1",
      referee_id: "j1",
      referee_name: "Ana",
      status: "borrador",
      total_amount: "120,50", // coma decimal: Number() da NaN
      duties_amount: "x",
      session_count: "dos",
    });
    expect(c.totalAmount).toBe(0);
    expect(c.dutiesAmount).toBe(0);
    expect(c.sessionCount).toBe(0);
    expect(Number.isNaN(c.functionCount)).toBe(false);
  });

  it("unos km ilegibles son km sin resolver, no cero km", () => {
    const c = mapCompensationClaimRow({
      id: "cmp-1", competition_id: "c1", referee_id: "j1", referee_name: "Ana",
      status: "borrador", distance_km_round_trip: "cien", distance_km_one_way: "",
    });
    expect(c.distanceKmRoundTrip).toBeUndefined();
    expect(c.distanceKmOneWay).toBeUndefined();
  });

  it("y las líneas de conceptos", () => {
    const l = mapCompensationDutyLine({
      duty_type: "session", session_label: null,
      unit_amount: "x", quantity: "y", amount: "z", slot_keys: "no-es-un-array",
    });
    expect(l.session).toBe("");
    expect(l.unitAmount).toBe(0);
    expect(l.quantity).toBe(1);
    expect(l.amount).toBe(0);
    expect(l.slotKeys).toEqual([]);
  });
});

describe("el recibo no se imprime con «NaN€»", () => {
  it("un importe que no es un número se enseña como hueco", () => {
    // `NaN <= 0` es `false`, así que un importe ilegible se colaba por el
    // guarda de «importe positivo» de la ruta de exportación y llegaba al PDF.
    expect(formatReceiptAmountEur(Number.NaN)).toBe("—");
    expect(formatReceiptAmountEur(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("y un importe de verdad se sigue formateando igual", () => {
    expect(formatReceiptAmountEur(120.5)).toBe("120,50€");
    expect(formatReceiptAmountEur(90)).toBe("90€");
  });
});
