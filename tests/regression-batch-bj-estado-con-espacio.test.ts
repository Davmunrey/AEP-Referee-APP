import { describe, expect, it } from "vitest";
import {
  isRosterFrozen,
  isRosterImprevistoMode,
  isRosterLockedByApproval,
  isRosterPendingApproval,
  isRosterRejected,
  ROSTER_IMPREVISTO_STATE,
} from "@/lib/roster-coverage";
import { checkRosterMutationAllowed } from "@/lib/roster-route-guards";

/**
 * `competitions.aprobacion` es TEXT y lo escriben varios caminos: la app, la
 * importación de calendario y, alguna vez, una mano en el editor de Supabase.
 * De reconocer ese valor depende CONGELAR la tarima.
 */

const VARIANTES_APROBADO = ["Aprobado ", " Aprobado", "aprobado", "APROBADO", "  Aprobado  "];
const VARIANTES_PENDIENTE = [
  "propuesta enviada",
  "Propuesta  enviada",
  " Propuesta enviada ",
  "PROPUESTA ENVIADA",
];

describe("un estado con un espacio de más no puede abrir una tarima cerrada", () => {
  it.each(VARIANTES_APROBADO)("«%s» sigue siendo una tarima aprobada", (valor) => {
    // Con `===` exacto esto daba `false`: se podía editar una tarima ya
    // aprobada, y el acta dejaba de coincidir con lo que se aprobó.
    expect(isRosterLockedByApproval(valor)).toBe(true);
    expect(isRosterFrozen(valor)).toBe(true);
  });

  it.each(VARIANTES_PENDIENTE)("«%s» sigue siendo una propuesta pendiente", (valor) => {
    expect(isRosterPendingApproval(valor)).toBe(true);
    expect(isRosterFrozen(valor)).toBe(true);
  });

  it("y el guarda de escritura corta con esas variantes", () => {
    // Es lo que de verdad importa: por ahí pasan asignar, vaciar, guardar
    // plantilla y enviar a aprobación.
    const comp = { zona: "CENTRO", fecha: "2026-05-01", fechaFin: "2026-05-01" };
    for (const valor of [...VARIANTES_APROBADO, ...VARIANTES_PENDIENTE]) {
      const guard = checkRosterMutationAllowed({ ...comp, aprobacion: valor }, true);
      expect(guard.ok).toBe(false);
    }
  });

  it("el rechazo, que ya normalizaba, se comporta igual que antes", () => {
    expect(isRosterRejected("rechazado ")).toBe(true);
    expect(isRosterRejected("Rechazado")).toBe(true);
    expect(isRosterRejected(null)).toBe(false);
  });

  it("un estado que no es ninguno de esos no congela nada", () => {
    expect(isRosterFrozen("Sin propuesta")).toBe(false);
    expect(isRosterFrozen(undefined)).toBe(false);
    expect(isRosterFrozen("")).toBe(false);
  });

  it("el modo imprevisto se queda con la comparación exacta, y es a propósito", () => {
    // Ese estado ABRE la tarima: aflojar su reconocimiento sería aflojar el
    // cierre, y lo escribe siempre la propia aplicación.
    expect(isRosterImprevistoMode(ROSTER_IMPREVISTO_STATE)).toBe(true);
    expect(isRosterImprevistoMode("cambio por imprevisto")).toBe(false);
  });
});
