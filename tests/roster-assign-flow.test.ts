import { beforeEach, describe, expect, it } from "vitest";
import type { Referee, RosterSession } from "@/lib/types";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { getStore, setCompetitionTemplate } from "@/server/store";
import {
  assignReferee,
  createCompetition,
  getRoster,
  setSlotFlags,
} from "@/server/services/memory-competitions";

const referee: Referee = {
  id: "ref-flow-1",
  nombre: "Juez Solapado",
  zona: "CENTRO",
  nivel: "Nacional",
  estado: "Activo",
  eventos: 3,
  ultimo: "2026-01-01",
  disp: true,
  iniciales: "JS",
};

// S1 y S2 con tarima (central + lateral) y pesaje, para cubrir los tres casos.
const template: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [
      { rol: "Juez Central", slots: 1, key: "central" },
      { rol: "Juez Lateral", slots: 2, key: "lateral" },
    ],
    pesajeRoles: [{ rol: "Pesaje", slots: 1, key: "pesaje" }],
  },
  {
    sesion: "S2",
    nombre: "Sesión 2",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "14:00 - 17:00",
    horarioPesaje: "12:00 - 13:30",
    roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
    pesajeRoles: [{ rol: "Pesaje", slots: 1, key: "pesaje" }],
  },
];

async function freshCompetition() {
  const store = getStore();
  store.referees.length = 0;
  store.referees.push(referee);
  const comp = await createCompetition({
    nombre: "Flow Test",
    tipo: "AEP-2",
    fecha: "2026-05-01",
    fechaFin: "2026-05-02",
    sede: "Madrid",
    sesiones: 2,
    requeridos: 8,
    zona: "CENTRO",
  });
  setCompetitionTemplate(comp.id, template);
  return comp.id;
}

describe("assignReferee end-to-end (memory service)", () => {
  beforeEach(() => {
    const store = getStore();
    store.competitions.length = 0;
    store.assignments.clear();
    store.slotFlags.clear();
    store.templates.clear();
  });

  it("allows platform + weigh-in of the same session (sequential, no overlap)", async () => {
    const id = await freshCompetition();
    expect((await assignReferee(id, "S1_central_0", referee.id, "tester")).error).toBeUndefined();
    // Pesaje de la misma sesión es secuencial → permitido.
    expect((await assignReferee(id, "S1_pesaje_0", referee.id, "tester")).error).toBeUndefined();
  });

  it("blocks two overlapping platform positions in the same session", async () => {
    const id = await freshCompetition();
    await assignReferee(id, "S1_central_0", referee.id, "tester");
    const res = await assignReferee(id, "S1_lateral_0", referee.id, "tester");
    expect(res.error).toMatch(/otra posición/i);
  });

  it("lets the * (compartido) flag force a same-session overlap", async () => {
    const id = await freshCompetition();
    await assignReferee(id, "S1_central_0", referee.id, "tester");
    const res = await assignReferee(id, "S1_lateral_0", referee.id, "tester", {
      compartido: true,
    });
    expect(res.error).toBeUndefined();
    expect(res.flags?.S1_lateral_0?.compartido).toBe(true);
  });

  it("blocks control S1 + pesaje S2 but allows it once the existing slot is marked *", async () => {
    const id = await freshCompetition();
    await assignReferee(id, "S1_central_0", referee.id, "tester");

    // Sin marcar nada: bloqueado (pesaje de la sesión siguiente solapa la tarima).
    const blocked = await assignReferee(id, "S2_pesaje_0", referee.id, "tester");
    expect(blocked.error).toMatch(/sesión siguiente/i);

    // Marca el puesto existente como compartido y reintenta → permitido.
    const flagged = await setSlotFlags(id, "S1_central_0", { compartido: true }, "tester");
    expect("error" in flagged).toBe(false);
    const allowed = await assignReferee(id, "S2_pesaje_0", referee.id, "tester");
    expect(allowed.error).toBeUndefined();

    const roster = await getRoster(id);
    expect(roster?.assignments.S2_pesaje_0).toBe(referee.id);
  });

  it("lets control S1 + pesaje S2 succeed when forcing the new slot as *", async () => {
    const id = await freshCompetition();
    await assignReferee(id, "S1_central_0", referee.id, "tester");
    const res = await assignReferee(id, "S2_pesaje_0", referee.id, "tester", {
      compartido: true,
    });
    expect(res.error).toBeUndefined();
    expect(res.flags?.S2_pesaje_0?.compartido).toBe(true);
  });
});
