import { afterEach, describe, expect, it, vi } from "vitest";
import { addDaysIso, todayIso } from "@/lib/business-date";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import { formatSanctionPeriod, isSanctionActive, resolveSanctionEndDate } from "@/lib/sanctions";

// La aplicación se despliega en UTC, así que `new Date().toISOString()` da el
// día equivocado entre la medianoche española y las 01:00–02:00 UTC. Todo lo
// que sea una fecha con valor propio tiene que ir por el día natural español.

/** 1 de julio de 2026, 00:30 en Madrid (CEST) → 30 de junio, 22:30 UTC. */
const MEDIANOCHE_MADRID = new Date("2026-06-30T22:30:00Z");

afterEach(() => {
  vi.useRealTimers();
});

describe("todayIso", () => {
  it("devuelve el día español recién pasada la medianoche, no el UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MEDIANOCHE_MADRID);
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-06-30");
    expect(todayIso()).toBe("2026-07-01");
  });
});

describe("addDaysIso", () => {
  it("suma días naturales sin depender del huso del servidor", () => {
    expect(addDaysIso("2026-05-01", 30)).toBe("2026-05-31");
    expect(addDaysIso("2026-05-01", 365)).toBe("2027-05-01");
  });

  it("cruza el cambio de hora sin desplazarse un día", () => {
    // El cambio a horario de verano en España es el 29 de marzo de 2026.
    expect(addDaysIso("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("devuelve la entrada si la fecha no es válida, en vez de reventar", () => {
    expect(addDaysIso("no-es-fecha", 7)).toBe("no-es-fecha");
  });
});

describe("sanciones a caballo de la medianoche española", () => {
  it("una sanción que termina hoy sigue activa hasta acabar el día español", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MEDIANOCHE_MADRID);
    expect(isSanctionActive({ status: "activa", fechaFin: "2026-07-01" })).toBe(true);
    expect(isSanctionActive({ status: "activa", fechaFin: "2026-06-30" })).toBe(false);
  });

  it("la fecha de fin del preset cuenta días naturales desde el inicio", () => {
    expect(resolveSanctionEndDate("2026-07-01", "30d")).toBe("2026-07-31");
  });

  it("el periodo se formatea en la zona de negocio", () => {
    expect(formatSanctionPeriod("2026-07-01", "2026-07-31")).toBe(
      "1 jul 2026 → 31 jul 2026",
    );
  });
});

describe("pickActiveRosterHref", () => {
  it("el campeonato de hoy sigue contando como próximo tras la medianoche", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MEDIANOCHE_MADRID);
    const href = pickActiveRosterHref([
      { id: "evt-hoy", fecha: "2026-07-01", estado: "Incompleto" },
      { id: "evt-pasado", fecha: "2026-06-01", estado: "Incompleto" },
    ]);
    expect(href).toBe("/competitions/evt-hoy");
  });
});
