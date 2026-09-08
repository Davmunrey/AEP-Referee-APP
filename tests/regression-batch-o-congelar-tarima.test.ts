import { beforeEach, describe, expect, it } from "vitest";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import {
  isRosterFrozen,
  isRosterPendingApproval,
  rosterMutationBlockedMessage,
  ROSTER_IMPREVISTO_STATE,
} from "@/lib/roster-coverage";
import { checkRosterMutationAllowed } from "@/lib/roster-route-guards";
import { getStore } from "@/server/store";
import {
  assignReferee,
  createCompetition,
  getApprovals,
  getRosterHistory,
  saveCompetitionTemplate,
  submitRoster,
  unlockImprevisto,
} from "@/server/services/memory-competitions";
import { createReferee } from "@/server/services/memory-referees";
import type { RosterSession } from "@/lib/types";

// La propuesta guarda un snapshot de las asignaciones y la aprobación lo
// reinserta borrando lo que haya. Mientras se pudo editar entre el envío y la
// aprobación, esos cambios se perdían en silencio: ni quien los hacía ni quien
// aprobaba se enteraban. Congelada la tarima, snapshot y realidad no divergen.

const SLOT = "S1_central_0";
const SLOT_2 = "S1_lateral_0";

function plantilla(): RosterSession[] {
  return [
    {
      sesion: "S1",
      nombre: "Sesión 1",
      dia: "Sábado",
      categorias: [{ genero: "Hombres", pesos: "-74" }],
      horarioCompeticion: "10:00 - 13:00",
      horarioPesaje: "08:00 - 09:30",
      roles: [
        { key: "central", rol: "Central", slots: 1 },
        { key: "lateral", rol: "Lateral", slots: 1 },
      ],
      pesajeRoles: [],
    },
  ];
}

async function escenario() {
  const store = getStore();
  store.competitions.length = 0;
  store.referees.length = 0;
  store.approvals.length = 0;
  store.assignments.clear();
  store.slotFlags.clear();
  store.history.length = 0;

  const comp = await createCompetition({
    nombre: "Copa de congelación",
    tipo: "AEP-2",
    fecha: "2027-05-01",
    fechaFin: "2027-05-01",
    sede: "Madrid",
    zona: "CENTRO",
    sesiones: 1,
    requeridos: 2,
  } as never);
  await saveCompetitionTemplate(comp.id, plantilla(), "Ana");

  const juezA = await createReferee({
    nombre: "Ana Pérez", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true,
  } as never);
  const juezB = await createReferee({
    nombre: "Bea López", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true,
  } as never);
  await assignReferee(comp.id, SLOT, juezA.id, "Ana", undefined, null);
  return { comp, juezA, juezB };
}

let ctx: Awaited<ReturnType<typeof escenario>>;

beforeEach(async () => {
  ctx = await escenario();
});

describe("tarima congelada con propuesta pendiente", () => {
  it("tras enviar la propuesta no se puede seguir editando", async () => {
    await submitRoster(ctx.comp.id, "Ana");

    const res = await assignReferee(ctx.comp.id, SLOT_2, ctx.juezB.id, "Carlos", undefined, null);
    expect(res.error).toMatch(/pendiente de aprobación/i);
    expect(getStore().assignments.get(ctx.comp.id)?.[SLOT_2]).toBeUndefined();
  });

  it("la ruta responde 423 con el motivo, no un 400 genérico", () => {
    const guard = checkRosterMutationAllowed(
      { fecha: "2027-05-01", fechaFin: "2027-05-01", aprobacion: "Propuesta enviada" },
      true,
    );
    expect(guard.ok).toBe(false);
    expect(guard.ok === false && guard.status).toBe(423);
    expect(guard.ok === false && guard.error).toMatch(/Retirar propuesta/);
  });

  it("una tarima sin propuesta sigue siendo editable", () => {
    expect(isRosterFrozen("Sin propuesta")).toBe(false);
    expect(isRosterFrozen("Rechazado")).toBe(false);
    expect(isRosterFrozen(ROSTER_IMPREVISTO_STATE)).toBe(false);
    expect(rosterMutationBlockedMessage("Sin propuesta")).toBeNull();
  });
});

describe("retirar la propuesta es la salida de la congelación", () => {
  it("devuelve la tarima a estado editable y la saca de la bandeja", async () => {
    // Sin salida, congelar sería una trampa: solo un delegado nacional puede
    // aprobar o rechazar, y la zona no podría ni corregir una baja.
    await submitRoster(ctx.comp.id, "Ana");
    expect((await getApprovals()).filter((a) => a.status === "pendiente")).toHaveLength(1);

    const res = await unlockImprevisto(ctx.comp.id, "Ana");
    expect("error" in res).toBe(false);
    expect((await getApprovals()).filter((a) => a.status === "pendiente")).toHaveLength(0);

    const comp = getStore().competitions.find((c) => c.id === ctx.comp.id);
    expect(comp?.aprobacion).toBe(ROSTER_IMPREVISTO_STATE);
    expect(isRosterPendingApproval(comp?.aprobacion)).toBe(false);
  });

  it("tras retirarla se vuelve a poder asignar", async () => {
    await submitRoster(ctx.comp.id, "Ana");
    await unlockImprevisto(ctx.comp.id, "Ana");

    const res = await assignReferee(ctx.comp.id, SLOT_2, ctx.juezB.id, "Ana", undefined, null);
    expect(res.error).toBeUndefined();
    expect(getStore().assignments.get(ctx.comp.id)?.[SLOT_2]).toBe(ctx.juezB.id);
  });

  it("la retirada queda registrada en el historial", async () => {
    await submitRoster(ctx.comp.id, "Ana");
    await unlockImprevisto(ctx.comp.id, "Ana");

    const historial = await getRosterHistory(ctx.comp.id);
    expect(historial.some((h) => h.action === "Propuesta retirada")).toBe(true);
  });

  it("sobre una tarima editable no hace nada", async () => {
    const res = await unlockImprevisto(ctx.comp.id, "Ana");
    expect("error" in res && res.error).toMatch(/ya se puede editar/i);
  });
});
