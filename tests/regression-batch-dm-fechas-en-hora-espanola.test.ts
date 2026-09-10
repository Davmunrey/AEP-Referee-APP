import { describe, expect, it } from "vitest";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/business-date";

/**
 * Las fechas se enseñan en hora ESPAÑOLA, no en la de quien las pinta.
 *
 * Sin `timeZone`, `toLocaleDateString` usa el huso del que renderiza. Los
 * componentes cliente se pintan DOS VECES —en el servidor, que va en UTC, y en
 * el navegador, en la hora del usuario—, así que cerca de la medianoche el HTML
 * servido decía un día y el navegador lo reescribía a otro, con el aviso de
 * hidratación correspondiente. Y para quien abre la aplicación desde otro huso,
 * la fecha era directamente la de su reloj.
 *
 * La convención ya estaba escrita en `formatSanctionPeriod` («Zona explícita:
 * sin ella el formato depende del huso del servidor») y en el cuadrante en
 * HTML; seis sitios se habían quedado fuera: el historial de tarima, el aviso
 * de imprevisto, las dos fechas de tickets, la ficha de informe, la pantalla de
 * cuentas y el sello de «delegado notificado».
 */

// 00:30 del 14 de marzo de 2026 en España. En marzo el reloj español va todavía
// en UTC+1, así que en UTC son las 23:30 del día 13: dos días a la vez.
const MADRUGADA = "2026-03-13T23:30:00.000Z";

const DIA = { day: "2-digit", month: "2-digit", year: "numeric" } as const;

describe("un instante de la madrugada española", () => {
  it("en ese instante el día UTC y el español NO son el mismo", () => {
    // Lo que hacían estos sitios era formatear sin `timeZone`, o sea con el
    // huso del que renderiza: en el servidor, UTC. Este es el día que salía.
    expect(new Date(MADRUGADA).toLocaleDateString("es-ES", { ...DIA, timeZone: "UTC" }))
      .toBe("13/03/2026");
  });

  it("se enseña con el día español, no con el UTC", () => {
    expect(formatBusinessDate(MADRUGADA, DIA))
      .toBe("14/03/2026");
  });

  it("y con su hora española", () => {
    expect(formatBusinessDateTime(MADRUGADA)).toContain("00:30");
    expect(formatBusinessDateTime(MADRUGADA)).toContain("14");
  });
});

describe("una fecha solo-día", () => {
  it("es ese día, no el anterior", () => {
    // `new Date("2026-03-14")` es medianoche UTC: en cualquier huso al oeste
    // caía en el 13. Se ancla al mediodía, como ya hacía `formatSanctionPeriod`.
    expect(formatBusinessDate("2026-03-14", DIA))
      .toBe("14/03/2026");
  });

  it("también en el cambio de mes", () => {
    expect(formatBusinessDate("2026-01-01", DIA))
      .toBe("01/01/2026");
  });
});

describe("lo que no es una fecha", () => {
  it("se devuelve tal cual en vez de «Invalid Date»", () => {
    expect(formatBusinessDate("pendiente")).toBe("pendiente");
    expect(formatBusinessDateTime("—")).toBe("—");
  });

  it("y el hueco vacío no inventa nada", () => {
    expect(formatBusinessDate("")).toBe("");
    expect(formatBusinessDate(null)).toBe("");
    expect(formatBusinessDateTime(undefined)).toBe("");
  });
});
