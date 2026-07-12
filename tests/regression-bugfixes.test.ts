import { describe, expect, it } from "vitest";
import type { RosterRole, RosterSession } from "@/lib/types";
import { compareSessions, sessionLabel, sessionOrder } from "@/lib/session-order";
import { mergeRosterTemplateSessions } from "@/lib/roster-template";
import {
  computeRosterCoverage,
  deriveCompetitionEstado,
} from "@/lib/roster-coverage";
import { buildCompetitionSlotLayout } from "@/lib/roster-slot-layout";
import { deduceMacroZone } from "@/lib/aep-zones";
import { daysUntil } from "@/lib/dashboard-intelligence";
import { parseIntegerKm } from "@/lib/judge-compensation/km";
import { parseSelectedImportKeys } from "@/lib/import-security";
import { getPageMeta } from "@/lib/navigation";
import { competitionDedupKey } from "@/lib/competition-dedup";
import { parseCompetitionDateRange } from "@/lib/judges-registry/parse-dates";
import { isTravelModeResolved } from "@/lib/judge-compensation/readiness";

function session(sesion: string, roles: RosterRole[], pesajeRoles: RosterRole[] = []): RosterSession {
  return {
    sesion,
    nombre: sesion,
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles,
    pesajeRoles,
  };
}

// --- session-order: primer grupo de dígitos, no todos concatenados -----------
describe("sessionOrder / sessionLabel (nombres de sesión con varios dígitos)", () => {
  it("usa solo el primer número", () => {
    expect(sessionOrder("Sesión 2 grupo 3")).toBe(2);
    expect(sessionLabel("Sesión 2 grupo 3")).toBe("S2");
  });
  it("mantiene el orden numérico correcto (S10 después de S2 con sufijo)", () => {
    expect(compareSessions("S10", "Sesión 2 grupo 3")).toBeGreaterThan(0);
  });
  it("presets siguen intactos", () => {
    expect(sessionLabel("S1")).toBe("S1");
    expect(sessionOrder("SESIÓN 10")).toBe(10);
  });
});

// --- roster-template: no borrar sesiones sin sustituto entrante --------------
describe("mergeRosterTemplateSessions (pérdida de datos)", () => {
  it("conserva una sesión existente marcada para reemplazo pero ausente del import", () => {
    const existing = [
      session("S1", [{ rol: "Central", slots: 1, key: "central" }]),
      session("S2", [{ rol: "Central", slots: 1, key: "central" }]),
    ];
    const incoming = [session("S1", [{ rol: "Central", slots: 2, key: "central" }])];
    const merged = mergeRosterTemplateSessions(existing, incoming, new Set(["S1", "S2"]));
    expect(merged.map((s) => s.sesion).sort()).toEqual(["S1", "S2"]);
    // S1 se sustituye (2 slots); S2 se conserva intacta (1 slot).
    expect(merged.find((s) => s.sesion === "S1")?.roles[0]?.slots).toBe(2);
    expect(merged.find((s) => s.sesion === "S2")?.roles[0]?.slots).toBe(1);
  });
});

// --- roster-coverage: plantilla con 0 slots reales no es 100% ---------------
describe("computeRosterCoverage (plantilla sin slots reales)", () => {
  it("no fabrica confirmados cuando todos los roles tienen slots:0", () => {
    const template = [session("S1", [{ rol: "Central", slots: 0, key: "central" }])];
    const cov = computeRosterCoverage(template, {}, 8);
    expect(cov.confirmados).toBe(0);
    expect(cov.pct).toBe(0);
    expect(deriveCompetitionEstado(cov)).toBe("Borrador");
  });
});

// --- roster-slot-layout: sin celda central fantasma con slots:0 -------------
describe("buildCompetitionSlotLayout (central con slots:0)", () => {
  it("no coloca una celda central cuando el rol tiene 0 slots", () => {
    const rows = buildCompetitionSlotLayout([
      { rol: "Central", slots: 0, key: "central" },
      { rol: "Lateral", slots: 2, key: "lateral" },
    ]);
    const centralCells = rows
      .flatMap((r) => r.cells)
      .filter((c) => c?.role.key === "central");
    expect(centralCells).toHaveLength(0);
  });
});

// --- aep-zones: deduceMacroZone insensible a mayúsculas/acentos -------------
describe("deduceMacroZone (imports en MAYÚSCULAS)", () => {
  it("resuelve provincias en mayúsculas y sin variar acento", () => {
    expect(deduceMacroZone("MÁLAGA", "")).toBe("ANDALUCIA");
    expect(deduceMacroZone("malaga", "")).toBe("ANDALUCIA");
    expect(deduceMacroZone(undefined, "MADRID")).toBe("CENTRO");
  });
});

// --- dashboard daysUntil: parseo por componentes, hoy = 0 -------------------
describe("daysUntil (robusto a zona horaria)", () => {
  it("hoy es 0 y las fechas futuras cuentan exacto", () => {
    const now = new Date(2026, 6, 12, 15, 0, 0);
    expect(daysUntil("2026-07-12", now)).toBe(0);
    expect(daysUntil("2026-07-19", now)).toBe(7);
  });
  it("null para fechas inválidas", () => {
    expect(daysUntil("no-es-fecha")).toBeNull();
    expect(daysUntil("2026-13-40")).toBeNull();
  });
});

// --- km: espacios en blanco → null, no 0 ------------------------------------
describe("parseIntegerKm (blanco vs cero)", () => {
  it("cadena de solo espacios es null (desconocido), no 0", () => {
    expect(parseIntegerKm("   ")).toBeNull();
    expect(parseIntegerKm("")).toBeNull();
    expect(parseIntegerKm(" 10 ")).toBe(10);
    expect(parseIntegerKm(-5)).toBeNull();
  });
});

// --- import-security: la selección válida máxima no se rechaza ---------------
describe("parseSelectedImportKeys (límite superior)", () => {
  it("acepta 500 claves de 160 chars (peor caso válido)", () => {
    const key = "k".repeat(160);
    const raw = JSON.stringify(Array.from({ length: 500 }, () => key));
    const result = parseSelectedImportKeys(raw);
    expect(result?.size).toBe(1); // 500 claves idénticas → Set de 1
  });
  it("sigue rechazando payloads realmente excesivos", () => {
    const raw = JSON.stringify(Array.from({ length: 600 }, (_, i) => `k${i}`.repeat(60)));
    expect(() => parseSelectedImportKeys(raw)).toThrow();
  });
});

// --- navigation: /competitions/new no queda oculto por el prefijo genérico ---
describe("getPageMeta (/competitions/new)", () => {
  it("da el título y breadcrumb de nuevo campeonato", () => {
    const meta = getPageMeta("/competitions/new");
    expect(meta.title).toBe("Nuevo campeonato");
    expect(meta.crumbs.at(-1)?.label).toBe("Nuevo");
  });
  it("el detalle de campeonato sigue funcionando", () => {
    expect(getPageMeta("/competitions/evt-001").title).toBe("Constructor de Tarima");
  });
});

// --- competition-dedup: puntuación no rompe la clave ------------------------
describe("competitionDedupKey (puntuación)", () => {
  it("mismo evento con/sin paréntesis comparte clave", () => {
    const a = competitionDedupKey({ nombre: "Cto de España (Junior)", fecha: "2026-03-01", tipo: "AEP-1" });
    const b = competitionDedupKey({ nombre: "Cto de España Junior", fecha: "2026-03-01", tipo: "AEP-1" });
    expect(a).toBe(b);
  });
});

// --- parse-dates: celda de fecha tipo Date en import xlsx -------------------
describe("parseCompetitionDateRange (celda Date de cellDates:true)", () => {
  it("no descarta una competición cuyo inicio es un objeto Date", () => {
    const range = parseCompetitionDateRange(new Date(2026, 2, 1));
    expect(range).toEqual({ fecha: "2026-03-01", fechaFin: "2026-03-01" });
  });
});

// --- readiness: km inválido no cuenta como resuelto -------------------------
describe("isTravelModeResolved (km inválido)", () => {
  it("km de ida negativo/ inválido no marca el viaje como resuelto", () => {
    expect(isTravelModeResolved("km_rate", null, -10)).toBe(false);
    expect(isTravelModeResolved("km_rate", null, 100)).toBe(true);
    expect(isTravelModeResolved("none", null, null)).toBe(true);
  });
});
