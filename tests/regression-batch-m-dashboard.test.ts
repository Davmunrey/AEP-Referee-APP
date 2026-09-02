import { beforeEach, describe, expect, it } from "vitest";
import { businessHour } from "@/lib/business-date";
import { coveragePct } from "@/lib/roster-coverage";
import {
  isAutoSyncPaused,
  setAutoSyncPaused,
} from "@/lib/realtime/sync-events";

// Ronda 13: panel. La fórmula de cobertura estaba copiada en seis sitios con
// tres comportamientos distintos, y el control de «Pausar» no pausaba nada.

describe("coveragePct", () => {
  it("sin plazas requeridas no hay cobertura que enseñar", () => {
    // El panel (previsión y radar) devolvía 100 %: un campeonato sin plantilla
    // salía con la barra verde llena mientras la tabla de campeonatos lo
    // pintaba al 0 %.
    expect(coveragePct(0, 0)).toBe(0);
    expect(coveragePct(5, 0)).toBe(0);
  });

  it("capa al 100 % aunque haya más asignaciones que plazas", () => {
    // Sin el cap, `aria-valuenow` superaba el `aria-valuemax` y la barra se
    // anunciaba como «Cobertura: 150 %».
    expect(coveragePct(15, 10)).toBe(100);
  });

  it("no baja de cero", () => {
    expect(coveragePct(-3, 10)).toBe(0);
  });

  it("redondea al entero más próximo", () => {
    expect(coveragePct(1, 3)).toBe(33);
    expect(coveragePct(2, 3)).toBe(67);
    expect(coveragePct(6, 12)).toBe(50);
    expect(coveragePct(12, 12)).toBe(100);
  });
});

describe("pausa de la sincronización automática", () => {
  beforeEach(() => {
    setAutoSyncPaused(false);
  });

  it("arranca despausada", () => {
    expect(isAutoSyncPaused()).toBe(false);
  });

  it("el estado es compartido entre módulos, no local al control", () => {
    // `DashboardLive` la activa y `AppRealtimeSync` la obedece: son dos
    // componentes cliente sin parentesco, así que antes el botón solo cambiaba
    // su propia etiqueta mientras el panel seguía refrescándose.
    setAutoSyncPaused(true);
    expect(isAutoSyncPaused()).toBe(true);
    setAutoSyncPaused(false);
    expect(isAutoSyncPaused()).toBe(false);
  });
});

describe("businessHour", () => {
  it("da la hora española aunque el proceso vaya en UTC", () => {
    // 22:30 UTC = 00:30 en Madrid (CEST). Con `new Date().getHours()` el
    // servidor decía «Buenas tardes» (22) y el navegador «Buenas noches» (0),
    // así que React reescribía el encabezado al hidratar.
    expect(businessHour(new Date("2026-06-30T22:30:00Z"))).toBe(0);
    expect(new Date("2026-06-30T22:30:00Z").getUTCHours()).toBe(22);
  });

  it("cubre el rango completo del día", () => {
    // Invierno (CET, +1) y verano (CEST, +2).
    expect(businessHour(new Date("2026-01-15T23:00:00Z"))).toBe(0);
    expect(businessHour(new Date("2026-06-15T10:00:00Z"))).toBe(12);
    expect(businessHour(new Date("2026-06-15T21:00:00Z"))).toBe(23);
  });
});
