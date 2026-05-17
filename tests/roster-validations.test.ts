import { describe, expect, it } from "vitest";
import {
  assignRefereeSchema,
  clearSlotSchema,
  rosterTemplateSchema,
} from "@/lib/validations";

const minimalSession = {
  sesion: "S1",
  nombre: "Sesión 1",
  dia: "Viernes",
  categorias: [{ genero: "Hombres" as const, pesos: "83" }],
  horarioCompeticion: "09:00",
  horarioPesaje: "08:00",
  roles: [{ rol: "Central", slots: 1, key: "central" as const }],
  pesajeRoles: [],
};

describe("roster API validations", () => {
  it("assignRefereeSchema requires slot and referee", () => {
    expect(() =>
      assignRefereeSchema.parse({
        eventId: "e1",
        slotKey: "",
        refereeId: "r1",
      }),
    ).toThrow();
  });

  it("clearSlotSchema parses", () => {
    expect(clearSlotSchema.parse({ eventId: "e1", slotKey: "s1" })).toEqual({
      eventId: "e1",
      slotKey: "s1",
    });
  });

  it("rosterTemplateSchema accepts minimal session", () => {
    const parsed = rosterTemplateSchema.parse([minimalSession]);
    expect(parsed).toHaveLength(1);
  });

  it("rosterTemplateSchema rejects empty template", () => {
    expect(() => rosterTemplateSchema.parse([])).toThrow();
  });
});
