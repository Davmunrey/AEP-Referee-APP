import { beforeEach, describe, expect, it } from "vitest";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { getStore } from "@/server/store";
import {
  assignReferee,
  createCompetition,
  saveCompetitionTemplate,
} from "@/server/services/memory-competitions";
import { createReferee } from "@/server/services/memory-referees";
import {
  compensationClaimKey,
  compensationStore,
} from "@/server/services/memory-compensation-store";
import type { RosterSession } from "@/lib/types";

function sesion(codigo: string): RosterSession {
  return {
    sesion: codigo,
    nombre: `Sesión ${codigo}`,
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-74" }],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ key: "central", rol: "Central", slots: 1 }],
    pesajeRoles: [],
  };
}

async function escenario() {
  const store = getStore();
  store.competitions.length = 0;
  store.referees.length = 0;
  store.assignments.clear();
  store.slotFlags.clear();
  store.history.length = 0;
  compensationStore.clear();

  const comp = await createCompetition({
    nombre: "Camp",
    tipo: "AEP-2",
    fecha: "2026-05-01",
    fechaFin: "2026-05-02",
    sede: "Madrid",
    sesiones: 2,
    requeridos: 2,
    zona: "CENTRO",
  });
  await saveCompetitionTemplate(comp.id, [sesion("S1"), sesion("S2")], "Tester");
  const juez = await createReferee({
    nombre: "Juez Pagado",
    zona: "CENTRO",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 0,
    ultimo: "—",
    disp: true,
  });
  await assignReferee(comp.id, "S2_central_0", juez.id, "Tester");
  return { compId: comp.id, refereeId: juez.id };
}

function marcarPagada(compId: string, refereeId: string) {
  compensationStore.set(compensationClaimKey(compId, refereeId), {
    refereeId,
    status: "pagado",
  } as never);
}

beforeEach(() => {
  compensationStore.clear();
});

describe("cambiar la plantilla no puede dejar sin puesto a un juez pagado", () => {
  it("quitar la sesión donde está bloquea el guardado", async () => {
    const { compId, refereeId } = await escenario();
    marcarPagada(compId, refereeId);

    // Vaciar la tarima y liberar el hueco ya estaban protegidos; quitar la
    // sesión de la plantilla borraba las mismas filas por otra puerta.
    await expect(
      saveCompetitionTemplate(compId, [sesion("S1")], "Tester"),
    ).rejects.toThrow(/liquidación pagada/);

    // Ni plantilla ni asignaciones se han tocado.
    expect(getStore().assignments.get(compId)?.["S2_central_0"]).toBe(refereeId);
    expect(getStore().templates.get(compId)).toHaveLength(2);
  });

  it("borrar la plantilla entera, igual", async () => {
    const { compId, refereeId } = await escenario();
    marcarPagada(compId, refereeId);
    await expect(saveCompetitionTemplate(compId, [], "Tester")).rejects.toThrow(
      /liquidación pagada/,
    );
    expect(getStore().assignments.get(compId)?.["S2_central_0"]).toBe(refereeId);
  });

  it("sin liquidación pagada la plantilla se cambia con normalidad", async () => {
    const { compId } = await escenario();
    const result = await saveCompetitionTemplate(compId, [sesion("S1")], "Tester");
    expect(result?.template).toHaveLength(1);
    expect(result?.assignments["S2_central_0"]).toBeUndefined();
  });

  it("una sesión que se conserva no bloquea nada aunque haya pago", async () => {
    const { compId, refereeId } = await escenario();
    marcarPagada(compId, refereeId);
    const result = await saveCompetitionTemplate(compId, [sesion("S2")], "Tester");
    expect(result?.assignments["S2_central_0"]).toBe(refereeId);
  });
});

// El mismo corte en el backend de producción, y que ocurra ANTES de escribir
// la plantilla: `regression-batch-ak-plantilla-y-pago-supabase`.
